import {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} from "unique-names-generator";
import { EditorState, Compartment } from "@codemirror/state";
import { ViewUpdate, lineNumbers, keymap } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { markdown } from "@codemirror/lang-markdown";
import { Extension, Prec } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { vim } from "@replit/codemirror-vim";
import { AppSettings, Universe } from "./AppSettings";
import { editorSetup } from "./EditorSetup";
import { documentation_factory } from "./Documentation";
import { EditorView } from "codemirror";
import { Clock } from "./Clock";
import { loadSamples, UserAPI } from "./API";
import { makeArrayExtensions } from "./ArrayExtensions";
import "./style.css";
import {
  Universes,
  File,
  template_universe,
  template_universes,
} from "./AppSettings";
import { tryEvaluate } from "./Evaluator";

// Importing showdown and setting up the markdown converter
import showdown from "showdown";
showdown.setFlavor("github");
import showdownHighlight from "showdown-highlight";
const classMap = {
  h1: "text-white lg:text-4xl text-xl lg:ml-4 lg:mx-4 mx-2 lg:my-4 my-2 lg:mb-8 mb-4 bg-neutral-900 rounded-lg py-2 px-2",
  h2: "text-white lg:text-3xl text-xl lg:ml-4 lg:mx-4 mx-2 lg:my-4 my-2 lg:mb-8 mb-4 bg-neutral-900 rounded-lg py-2 px-2",
  ul: "text-underline pl-6",
  li: "list-disc lg:text-2xl text-base text-white lg:mx-4 mx-2 my-4 my-2 leading-normal",
  p: "lg:text-2xl text-base text-white lg:mx-4 mx-2 my-4 leading-normal",
  a: "lg:text-2xl text-base text-orange-300",
  code: "lg:my-4 sm:my-1 text-base lg:text-xl block whitespace-pre overflow-x-hidden",
  icode:
    "lg:my-1 my-1 lg:text-xl sm:text-xs text-white font-mono bg-neutral-600",
  blockquote: "text-neutral-200 border-l-4 border-neutral-500 pl-4 my-4 mx-4",
  details:
    "lg:mx-12 py-1 px-6 lg:text-2xl text-white rounded-lg bg-neutral-600",
  table:
    "justify-center lg:my-8 my-2 lg:mx-8 mx-2 lg:text-2xl text-base w-full text-left text-white border-collapse",
  thead:
    "text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400",
  th: "",
  td: "",
  tr: "",
};
const bindings = Object.keys(classMap).map((key) => ({
  type: "output",
  regex: new RegExp(`<${key}([^>]*)>`, "g"),
  //@ts-ignore
  replace: (match, p1) => `<${key} class="${classMap[key]}" ${p1}>`,
}));

export class Editor {
  universes: Universes = template_universes;
  selected_universe: string;
  local_index: number = 1;
  editor_mode: "global" | "local" | "init" | "notes" = "global";
  fontSize: Compartment;
  withLineNumbers: Compartment;
  vimModeCompartment: Compartment;
  chosenLanguage: Compartment;
  currentDocumentationPane: string = "introduction";

  settings = new AppSettings();
  editorExtensions: Extension[] = [];
  userPlugins: Extension[] = [];
  state: EditorState;
  api: UserAPI;
  selectedExample: string | null = "";
  docs: { [key: string]: string } = {};

  // Audio stuff
  audioContext: AudioContext;
  view: EditorView;
  clock: Clock;
  manualPlay: boolean = false;

  // Mouse position
  public _mouseX: number = 0;
  public _mouseY: number = 0;

  // Transport elements
  play_buttons: HTMLButtonElement[] = [
    document.getElementById("play-button-1") as HTMLButtonElement,
    //document.getElementById("play-button-2") as HTMLButtonElement,
  ];
  pause_buttons: HTMLButtonElement[] = [
    document.getElementById("pause-button-1") as HTMLButtonElement,
    //document.getElementById("pause-button-2") as HTMLButtonElement,
  ];
  stop_buttons: HTMLButtonElement[] = [
    document.getElementById("stop-button-1") as HTMLButtonElement,
    //document.getElementById("stop-button-2") as HTMLButtonElement,
  ];
  clear_buttons: HTMLButtonElement[] = [
    document.getElementById("clear-button-1") as HTMLButtonElement,
    //document.getElementById("clear-button-2") as HTMLButtonElement,
  ];
  load_universe_button: HTMLButtonElement = document.getElementById("load-universe-button") as HTMLButtonElement;

  documentation_button: HTMLButtonElement = document.getElementById(
    "doc-button-1"
  ) as HTMLButtonElement;
  eval_button: HTMLButtonElement = document.getElementById(
    "eval-button-1"
  ) as HTMLButtonElement;

  // Script selection elements
  local_button: HTMLButtonElement = document.getElementById(
    "local-button"
  ) as HTMLButtonElement;
  global_button: HTMLButtonElement = document.getElementById(
    "global-button"
  ) as HTMLButtonElement;
  init_button: HTMLButtonElement = document.getElementById(
    "init-button"
  ) as HTMLButtonElement;
  note_button: HTMLButtonElement = document.getElementById(
    "note-button"
  ) as HTMLButtonElement;
  settings_button: HTMLButtonElement = document.getElementById(
    "settings-button"
  ) as HTMLButtonElement;
  close_settings_button: HTMLButtonElement = document.getElementById(
    "close-settings-button"
  ) as HTMLButtonElement;
  universe_viewer: HTMLDivElement = document.getElementById(
    "universe-viewer"
  ) as HTMLDivElement;

  // Buffer modal
  buffer_modal: HTMLDivElement = document.getElementById(
    "modal-buffers"
  ) as HTMLDivElement;
  buffer_search: HTMLInputElement = document.getElementById(
    "buffer-search"
  ) as HTMLInputElement;

  // Local script tabs
  local_script_tabs: HTMLDivElement = document.getElementById(
    "local-script-tabs"
  ) as HTMLDivElement;

  // Font Size Slider
  font_size_slider: HTMLInputElement = document.getElementById(
    "font-size-slider"
  ) as HTMLInputElement;
  font_size_witness: HTMLSpanElement = document.getElementById(
    "font-size-witness"
  ) as HTMLSpanElement;

  // Line Numbers checkbox
  line_numbers_checkbox: HTMLInputElement = document.getElementById(
    "show-line-numbers"
  ) as HTMLInputElement;

  // Editor mode selection
  normal_mode_button: HTMLButtonElement = document.getElementById(
    "normal-mode"
  ) as HTMLButtonElement;
  vim_mode_button: HTMLButtonElement = document.getElementById(
    "vim-mode"
  ) as HTMLButtonElement;

  // Share button
  share_button: HTMLElement = document.getElementById(
    "share_button"
  ) as HTMLElement;

  // Error line
  error_line: HTMLElement = document.getElementById(
    "error_line"
  ) as HTMLElement;
  show_error: boolean = false;

  constructor() {
    // ================================================================================
    // Loading the universe from local storage
    // ================================================================================

    this.selected_universe = this.settings.selected_universe;
    this.universe_viewer.innerHTML = `Topos: ${this.selected_universe}`;
    this.universes = { ...template_universes, ...this.settings.universes };

    // ================================================================================
    // Audio context and clock
    // ================================================================================

    this.audioContext = new AudioContext({ latencyHint: "playback" });
    this.clock = new Clock(this, this.audioContext);

    // ================================================================================
    // User API
    // ================================================================================

    this.api = new UserAPI(this);
    makeArrayExtensions(this.api);

    // ================================================================================
    // CodeMirror Management
    // ================================================================================

    this.vimModeCompartment = new Compartment();
    this.withLineNumbers = new Compartment();
    this.chosenLanguage = new Compartment();
    this.fontSize = new Compartment();
    const vimPlugin = this.settings.vimMode ? vim() : [];
    const lines = this.settings.line_numbers ? lineNumbers() : [];
    const fontSizeModif = EditorView.theme({
      "&": {
        fontSize: `${this.settings.font_size}px`,
      },
      ".cm-gutters": {
        fontSize: `${this.settings.font_size}px`,
      },
    });

    this.editorExtensions = [
      this.withLineNumbers.of(lines),
      this.fontSize.of(fontSizeModif),
      this.vimModeCompartment.of(vimPlugin),
      editorSetup,
      oneDark,
      this.chosenLanguage.of(javascript()),
      EditorView.updateListener.of((v: ViewUpdate) => {
        v;
      }),
    ];

    let dynamicPlugins = new Compartment();

    // ================================================================================
    // Building the documentation
    // loadSamples().then(() => {
    //   this.docs = documentation_factory(this);
    // });
		let pre_loading = async () => { await loadSamples(); };
		pre_loading();
		this.docs = documentation_factory(this);
    // ================================================================================

    // ================================================================================
    // Application event listeners
    // ================================================================================

    document.addEventListener("keydown", (event: KeyboardEvent) => {
      // TAB should do nothing
      if (event.key === "Tab") {
        event.preventDefault();
      }

      if (event.ctrlKey && event.key === "s") {
        event.preventDefault();
        this.setButtonHighlighting("pause", true);
        this.clock.pause();
      }

      if (event.ctrlKey && event.key === "r") {
        event.preventDefault();
        this.setButtonHighlighting("stop", true);
        this.clock.stop();
      }

      if (event.ctrlKey && event.key === "p") {
        event.preventDefault();
        this.setButtonHighlighting("play", true);
        this.clock.start();
      }

      // Ctrl + Shift + V: Vim Mode
      if (
        (event.key === "v" || event.key === "V") &&
        event.ctrlKey &&
        event.shiftKey
      ) {
        this.settings.vimMode = !this.settings.vimMode;
        event.preventDefault();
        this.userPlugins = this.settings.vimMode ? [] : [vim()];
        this.view.dispatch({
          effects: dynamicPlugins.reconfigure(this.userPlugins),
        });
      }

      // Ctrl + Enter or Return: Evaluate the hovered code block
      if ((event.key === "Enter" || event.key === "Return") && event.ctrlKey) {
        event.preventDefault();
        this.currentFile().candidate = this.view.state.doc.toString();
        this.flashBackground("#2d313d", 200);
      }

      // Shift + Enter or Ctrl + E: evaluate the line
      if (
        (event.key === "Enter" && event.shiftKey) ||
        (event.key === "e" && event.ctrlKey)
      ) {
        event.preventDefault(); // Prevents the addition of a new line
        this.currentFile().candidate = this.view.state.doc.toString();
        this.flashBackground("#2d313d", 200);
      }

      // This is the modal to switch between universes
      if (event.ctrlKey && event.key === "b") {
        this.hideDocumentation();
				let existing_universes = document.getElementById("existing-universes");
				let known_universes = Object.keys(this.universes);
				let final_html = "<ul class='lg:h-80 lg:w-80 lg:pb-2 lg:pt-2 overflow-y-scroll text-white lg:mb-4 border rounded-lg bg-gray-800'>";
				known_universes.forEach((name) => {
					final_html += `
<li onclick="_loadUniverseFromInterface('${name}')" class="hover:fill-black hover:bg-white py-2 hover:text-black flex justify-between px-4">
	<p >${name}</p>
	<button onclick=_deleteUniverseFromInterface('${name}')>🗑</button>
</li>`;
				});
				final_html = final_html + "</ul>";
				existing_universes!.innerHTML = final_html;
        this.openBuffersModal();
      }

      // This is the modal that opens up the settings
      if (event.shiftKey && event.key === "Escape") {
        this.openSettingsModal();
      }

      if (event.ctrlKey && event.key === "l") {
        event.preventDefault();
        this.changeModeFromInterface("local");
        this.hideDocumentation();
        this.view.focus();
      }

      if (event.ctrlKey && event.key === "n") {
        event.preventDefault();
        this.changeModeFromInterface("notes");
        this.hideDocumentation();
        this.view.focus();
      }

      if (event.ctrlKey && event.key === "g") {
        event.preventDefault();
        this.changeModeFromInterface("global");
        this.hideDocumentation();
        this.view.focus();
      }

      if (event.ctrlKey && event.key === "i") {
        event.preventDefault();
        this.changeModeFromInterface("init");
        this.hideDocumentation();
        this.changeToLocalBuffer(0);
        this.view.focus();
      }

      if (event.ctrlKey && event.key === "d") {
        event.preventDefault();
        this.showDocumentation();
      }

      [112, 113, 114, 115, 116, 117, 118, 119, 120].forEach(
        (keycode, index) => {
          if (event.keyCode === keycode) {
            event.preventDefault();
            if (event.ctrlKey) {
              this.api.script(keycode - 111);
            } else {
              this.changeModeFromInterface("local");
              this.changeToLocalBuffer(index);
              this.hideDocumentation();
            }
          }
        }
      );

      if (event.keyCode == 121) {
        this.changeModeFromInterface("global");
        this.hideDocumentation();
      }
      if (event.keyCode == 122) {
        this.changeModeFromInterface("init");
        this.hideDocumentation();
      }
    });

    // ================================================================================
    // Interface buttons
    // ================================================================================

    const tabs = document.querySelectorAll('[id^="tab-"]');
    // Iterate over the tabs with an index
    for (let i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener("click", (event) => {
        // Updating the CSS accordingly
        tabs[i].classList.add("bg-orange-300");
        for (let j = 0; j < tabs.length; j++) {
          if (j != i) tabs[j].classList.remove("bg-orange-300");
        }
        this.currentFile().candidate = this.view.state.doc.toString();

        let tab = event.target as HTMLElement;
        let tab_id = tab.id.split("-")[1];
        this.local_index = parseInt(tab_id);
        this.updateEditorView();
      });
    }

    this.play_buttons.forEach((button) => {
      button.addEventListener("click", () => {
        this.setButtonHighlighting("play", true);
        this.clock.start();
      });
    });

    this.clear_buttons.forEach((button) => {
      button.addEventListener("click", () => {
        this.setButtonHighlighting("clear", true);
        if (confirm("Do you want to reset the current universe?")) {
          this.universes[this.selected_universe] = template_universe;
          this.updateEditorView();
        }
      });
    });

    this.documentation_button.addEventListener("click", () => {
      this.showDocumentation();
    });


    this.load_universe_button.addEventListener("click", () => {
				let query = this.buffer_search.value;
        if (query.length > 2 && query.length < 20 && !query.includes(" ")) {
          this.loadUniverse(query);
          this.settings.selected_universe = query;
          this.buffer_search.value = "";
          this.closeBuffersModal();
          this.view.focus();
        }
    });

    this.eval_button.addEventListener("click", () => {
      this.currentFile().candidate = this.view.state.doc.toString();
      this.flashBackground("#2d313d", 200);
    });

    this.pause_buttons.forEach((button) => {
      button.addEventListener("click", () => {
        this.setButtonHighlighting("pause", true);
        this.clock.pause();
      });
    });

    this.stop_buttons.forEach((button) => {
      button.addEventListener("click", () => {
        this.setButtonHighlighting("stop", true);
        this.clock.stop();
      });
    });

    this.local_button.addEventListener("click", () =>
      this.changeModeFromInterface("local")
    );
    this.global_button.addEventListener("click", () =>
      this.changeModeFromInterface("global")
    );
    this.init_button.addEventListener("click", () =>
      this.changeModeFromInterface("init")
    );
    this.note_button.addEventListener("click", () =>
      this.changeModeFromInterface("notes")
    );

    this.settings_button.addEventListener("click", () => {
      this.font_size_slider.value = this.settings.font_size.toString();
      this.font_size_witness.innerHTML = `Font Size: ${this.settings.font_size}px`;
      this.font_size_witness?.setAttribute(
        "style",
        `font-size: ${this.settings.font_size}px;`
      );
      this.line_numbers_checkbox.checked = this.settings.line_numbers;
      let modal_settings = document.getElementById("modal-settings");
      let editor = document.getElementById("editor");
      modal_settings?.classList.remove("invisible");
      editor?.classList.add("invisible");
    });

    this.close_settings_button.addEventListener("click", () => {
      let modal_settings = document.getElementById("modal-settings");
      let editor = document.getElementById("editor");
      modal_settings?.classList.add("invisible");
      editor?.classList.remove("invisible");
    });

    this.font_size_slider.addEventListener("input", () => {
      const new_value = this.font_size_slider.value;
      this.settings.font_size = parseInt(new_value);
      this.font_size_witness.style.fontSize = `${new_value}px`;
      this.font_size_witness.innerHTML = `Font Size: ${new_value}px`;

      let new_font_size = EditorView.theme({
        "&": { fontSize: new_value + "px" },
        ".cm-gutters": { fontSize: new_value + "px" },
      });
      this.view.dispatch({
        effects: this.fontSize.reconfigure(new_font_size),
      });
      this.settings.font_size = parseInt(new_value);
    });

    this.share_button.addEventListener("click", () => {
      this.share_button.classList.add("animate-spin");
      setInterval(
        () => this.share_button.classList.remove("animate-spin"),
        1000
      );
      // trigger a manual save
      this.currentFile().candidate = app.view.state.doc.toString();
      this.currentFile().committed = app.view.state.doc.toString();
      this.settings.saveApplicationToLocalStorage(app.universes, app.settings);
      // encode as a blob!
      this.share();
    });

    this.normal_mode_button.addEventListener("click", () => {
      this.settings.vimMode = false;
      this.view.dispatch({ effects: this.vimModeCompartment.reconfigure([]) });
    });

    this.line_numbers_checkbox.addEventListener("change", () => {
      let checked = this.line_numbers_checkbox.checked ? true : false;
      this.settings.line_numbers = checked;
      this.view.dispatch({
        effects: this.withLineNumbers.reconfigure(
          checked ? [lineNumbers()] : []
        ),
      });
    });

    this.vim_mode_button.addEventListener("click", () => {
      this.settings.vimMode = true;
      this.view.dispatch({
        effects: this.vimModeCompartment.reconfigure(vim()),
      });
    });

    this.buffer_search.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        let query = this.buffer_search.value;
        if (query.length > 2 && query.length < 20) {
          this.loadUniverse(query);
          this.settings.selected_universe = query;
          this.buffer_search.value = "";
          this.closeBuffersModal();
          this.view.focus();
        }
      }
    });
    tryEvaluate(this, this.universes[this.selected_universe.toString()].init);

    [
      "introduction",
      "interface",
      "code",
      "time",
      "sound",
      "samples",
      "synths",
      "patterns",
      "midi",
      "functions",
      "reference",
      "shortcuts",
      "about",
    ].forEach((e) => {
      let name = `docs_` + e;
      document.getElementById(name)!.addEventListener("click", async () => {
				if (name !== "docs_samples") {
					this.currentDocumentationPane = e;
					this.updateDocumentationContent();
				} else {
					console.log('Loading samples!');
					await loadSamples().then(() => {
						this.docs = documentation_factory(this)
						this.currentDocumentationPane = e;
						this.updateDocumentationContent();
					});
				}
      });
    });

    // Passing the API to the User
    Object.entries(this.api).forEach(([name, value]) => {
      (globalThis as Record<string, any>)[name] = value;
    });

    this.state = EditorState.create({
      extensions: [
        ...this.editorExtensions,
        EditorView.lineWrapping,
        dynamicPlugins.of(this.userPlugins),
        Prec.highest(
          keymap.of([
            {
              key: "Ctrl-Enter",
              run: () => {
                return true;
              },
            },
          ])
        ),
        keymap.of([indentWithTab]),
      ],
      doc: this.universes[this.selected_universe].global.candidate,
    });

    this.view = new EditorView({
      parent: document.getElementById("editor") as HTMLElement,
      state: this.state,
    });

    this.changeModeFromInterface("global");

    // Loading from URL bar
    let url = new URLSearchParams(window.location.search);
    if (url !== undefined) {
      let new_universe;
      if (url !== null) {
        const universeParam = url.get("universe");
        if (universeParam !== null) {
          new_universe = JSON.parse(atob(universeParam));
          const randomName: string = uniqueNamesGenerator({
            dictionaries: [adjectives, colors, animals],
          });
          this.loadUniverse(randomName, new_universe["universe"]);
          this.emptyUrl();
        }
      }
    }
  }

  get note_buffer() {
    return this.universes[this.selected_universe.toString()].notes;
  }

  get global_buffer() {
    return this.universes[this.selected_universe.toString()].global;
  }

  get init_buffer() {
    return this.universes[this.selected_universe.toString()].init;
  }

  get local_buffer() {
    return this.universes[this.selected_universe.toString()].locals[
      this.local_index
    ];
  }

  emptyUrl = () => {
    window.history.replaceState({}, document.title, "/");
  };

  parseHash = (hash: string) => {
    return JSON.parse(hash);
  };

  share() {
    const hashed_table = btoa(
      JSON.stringify({
        universe: this.settings.universes[this.selected_universe],
      })
    );
    const url = new URL(window.location.href);
    url.searchParams.set("universe", hashed_table);
    window.history.replaceState({}, "", url.toString());
    // Copy the text inside the text field
    navigator.clipboard.writeText(url.toString());
  }

  showDocumentation() {
    if (document.getElementById("app")?.classList.contains("hidden")) {
      document.getElementById("app")?.classList.remove("hidden");
      document.getElementById("documentation")?.classList.add("hidden");
    } else {
      document.getElementById("app")?.classList.add("hidden");
      document.getElementById("documentation")?.classList.remove("hidden");

      // Load and convert Markdown content from the documentation file
      this.updateDocumentationContent();
    }
  }

  hideDocumentation() {
    if (document.getElementById("app")?.classList.contains("hidden")) {
      document.getElementById("app")?.classList.remove("hidden");
      document.getElementById("documentation")?.classList.add("hidden");
    }
  }

  updateDocumentationContent() {
    const converter = new showdown.Converter({
      emoji: true,
      moreStyling: true,
      backslashEscapesHTMLTags: true,
      extensions: [showdownHighlight({ auto_detection: true }), ...bindings],
    });
    const converted_markdown = converter.makeHtml(
      this.docs[this.currentDocumentationPane]
    );
    document.getElementById("documentation-content")!.innerHTML =
      converted_markdown;
  }

  changeToLocalBuffer(i: number) {
    // Updating the CSS accordingly
    const tabs = document.querySelectorAll('[id^="tab-"]');
    const tab = tabs[i] as HTMLElement;
    tab.classList.add("bg-orange-300");
    for (let j = 0; j < tabs.length; j++) {
      if (j != i) tabs[j].classList.remove("bg-orange-300");
    }
    let tab_id = tab.id.split("-")[1];
    this.local_index = parseInt(tab_id);
    this.updateEditorView();
  }

  changeModeFromInterface(mode: "global" | "local" | "init" | "notes") {
    const interface_buttons: HTMLElement[] = [
      this.local_button,
      this.global_button,
      this.init_button,
      this.note_button,
    ];

    let changeColor = (button: HTMLElement) => {
      interface_buttons.forEach((button) => {
        let svg = button.children[0] as HTMLElement;
        if (svg.classList.contains("text-orange-300")) {
          svg.classList.remove("text-orange-300");
          button.classList.remove("text-orange-300");
        }
      });
      button.children[0].classList.remove("text-white");
      button.children[0].classList.add("text-orange-300");
      button.classList.add("text-orange-300");
    };

    switch (mode) {
      case "local":
        if (this.local_script_tabs.classList.contains("hidden")) {
          this.local_script_tabs.classList.remove("hidden");
        }
        this.editor_mode = "local";
        this.local_index = 0;
        this.changeToLocalBuffer(this.local_index);
        changeColor(this.local_button);
        break;
      case "global":
        if (!this.local_script_tabs.classList.contains("hidden")) {
          this.local_script_tabs.classList.add("hidden");
        }
        this.editor_mode = "global";
        changeColor(this.global_button);
        break;
      case "init":
        if (!this.local_script_tabs.classList.contains("hidden")) {
          this.local_script_tabs.classList.add("hidden");
        }
        this.editor_mode = "init";
        changeColor(this.init_button);
        break;
      case "notes":
        if (!this.local_script_tabs.classList.contains("hidden")) {
          this.local_script_tabs.classList.add("hidden");
        }
        this.editor_mode = "notes";
        changeColor(this.note_button);
        break;
    }

    // If the editor is in notes mode, we need to update the selectedLanguage

    this.view.dispatch({
      effects: this.chosenLanguage.reconfigure(
        this.editor_mode == "notes" ? [markdown()] : [javascript()]
      ),
    });

    this.updateEditorView();
  }

  setButtonHighlighting(
    button: "play" | "pause" | "stop" | "clear",
    highlight: boolean
  ) {
    this.flashBackground("#2d313d", 200);
    const possible_selectors = [
      '[id^="play-button-"]',
      '[id^="pause-button-"]',
      '[id^="clear-button-"]',
      '[id^="stop-button-"]',
    ];
    let selector: number;
    switch (button) {
      case "play":
        selector = 0;
        break;
      case "pause":
        selector = 1;
        break;
      case "clear":
        selector = 2;
        break;
      case "stop":
        selector = 3;
        break;
    }
    document
      .querySelectorAll(possible_selectors[selector])
      .forEach((button) => {
        if (highlight) button.children[0].classList.add("fill-orange-300");
        if (highlight) button.children[0].classList.add("animate-pulse");
      });
    // All other buttons must lose the highlighting
    document
      .querySelectorAll(
        possible_selectors.filter((_, index) => index != selector).join(",")
      )
      .forEach((button) => {
        button.children[0].classList.remove("fill-orange-300");
        button.children[0].classList.remove("text-orange-300");
        button.children[0].classList.remove("bg-orange-300");
        button.children[0].classList.remove("animate-pulse");
      });
  }

  unfocusPlayButtons() {
    document.querySelectorAll('[id^="play-button-"]').forEach((button) => {
      button.children[0].classList.remove("fill-orange-300");
      button.children[0].classList.remove("animate-pulse");
    });
  }

  updateEditorView(): void {
    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.toString().length,
        insert: this.currentFile().candidate,
      },
    });
  }

  /**
   * @returns The current file being edited
   */
  currentFile(): File {
    switch (this.editor_mode) {
      case "global":
        return this.global_buffer;
      case "local":
        return this.local_buffer;
      case "init":
        return this.init_buffer;
      case "notes":
        return this.note_buffer;
    }
  }

  /**
   * @param universeName: The name of the universe to load
   */
  loadUniverse(
    universeName: string,
    universe: Universe = template_universe
  ): void {
    console.log(universeName, universe);
    this.currentFile().candidate = this.view.state.doc.toString();

    // Getting the new universe name and moving on
    let selectedUniverse = universeName.trim();
    if (this.universes[selectedUniverse] === undefined) {
      this.settings.universes[selectedUniverse] = universe;
      this.universes[selectedUniverse] = universe;
    }
    this.selected_universe = selectedUniverse;
    this.settings.selected_universe = this.selected_universe;
    this.universe_viewer.innerHTML = `Topos: ${selectedUniverse}`;

    // Updating the editor View to reflect the selected universe
    this.updateEditorView();

    // Evaluating the initialisation script for the selected universe
    tryEvaluate(this, this.universes[this.selected_universe.toString()].init);
  }

  openSettingsModal(): void {
    if (
      document.getElementById("modal-settings")!.classList.contains("invisible")
    ) {
      document.getElementById("editor")!.classList.add("invisible");
      document.getElementById("modal-settings")!.classList.remove("invisible");
    } else {
      this.closeSettingsModal();
    }
  }

  closeSettingsModal(): void {
    document.getElementById("editor")!.classList.remove("invisible");
    document.getElementById("modal-settings")!.classList.add("invisible");
  }

  openBuffersModal(): void {
    // If the modal is hidden, unhide it and hide the editor
    if (
      document.getElementById("modal-buffers")!.classList.contains("invisible")
    ) {
      document.getElementById("editor")!.classList.add("invisible");
      document.getElementById("modal-buffers")!.classList.remove("invisible");
      document.getElementById("buffer-search")!.focus();
    } else {
      this.closeBuffersModal();
    }
  }

  closeBuffersModal(): void {
    // @ts-ignore
    document.getElementById("buffer-search")!.value = "";
    document.getElementById("editor")!.classList.remove("invisible");
    document.getElementById("modal")!.classList.add("invisible");
    document.getElementById("modal-buffers")!.classList.add("invisible");
  }

  /**
   * @param color the color to flash the background
   * @param duration the duration of the flash
   */
  flashBackground(color: string, duration: number): void {
    // Set the flashing color
    this.view.dom.style.backgroundColor = color;
    const gutters = this.view.dom.getElementsByClassName(
      "cm-gutter"
    ) as HTMLCollectionOf<HTMLElement>;
    Array.from(gutters).forEach(
      (gutter) => (gutter.style.backgroundColor = color)
    );

    // Reset to original color after duration
    setTimeout(() => {
      this.view.dom.style.backgroundColor = "";
      Array.from(gutters).forEach(
        (gutter) => (gutter.style.backgroundColor = "")
      );
    }, duration);
  }
}

// Creating the application
const app = new Editor();

// Starting the clock after displaying a modal
function startClock() {
  document.getElementById("editor")!.classList.remove("invisible");
  document.getElementById("modal")!.classList.add("hidden");
  document
    .getElementById("modal-container")!
    .classList.remove("motion-safe:animate-pulse");
  document
    .getElementById("start-button")!
    .removeEventListener("click", startClock);
  document.removeEventListener("click", startClock);
  document.removeEventListener("keydown", startOnEnter);
  document.removeEventListener("click", startOnClick);
  app.clock.start();
  app.view.focus();
  app.setButtonHighlighting("play", true);
}

function startOnEnter(e: KeyboardEvent) {
  if (e.code === "Enter" || e.code === "Space") startClock();
}

function startOnClick(e: MouseEvent) {
  if (e.button === 0) startClock();
}

document.addEventListener("keydown", startOnEnter);
document.addEventListener("click", startOnClick);
// document.getElementById("start-button")!.addEventListener("click", startClock);

/**
 * @param event The mouse event
 */
function reportMouseCoordinates(event: MouseEvent) {
  app._mouseX = event.clientX;
  app._mouseY = event.clientY;
}

window.addEventListener("mousemove", reportMouseCoordinates);

// When the user leaves the page, all the universes should be saved in the localStorage
window.addEventListener("beforeunload", () => {
  // @ts-ignore
  event.preventDefault();
  // Iterate over all local files and set the candidate to the committed
  app.currentFile().candidate = app.view.state.doc.toString();
  app.currentFile().committed = app.view.state.doc.toString();
  app.settings.saveApplicationToLocalStorage(app.universes, app.settings);
  app.clock.stop();
  return null;
});
