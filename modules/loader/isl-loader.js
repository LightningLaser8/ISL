/*
 _______     ______     __
|__   __|   /  __  \   |  |
   | |     |  |  \_/   |  |
   | |      \  \__     |  |
   | |       _\__ \    |  |
 __| |__    / \__| \   |  |____
|_______|   \______/   |_______|

[Infinity] Interpreted Sequence Language

Loader for ISL files. That's it.
*/

/**
 * Class to load ISL files, and optionally run them on an interpreter.
 */
class ISLFileLoader {
  #loaded = false;
  runOnLoad = false;
  #interpreter = null;
  constructor() {}
  #isl = [];
  get [Symbol.toStringTag]() {
    return "ISLFileLoader";
  }
  get loaded() {
    return this.#loaded;
  }
  /**
   * Sets up a file reader for an \<input\> element. Call this after `setupAutoRun`, if using it.
   * @param {String | HTMLInputElement} id HTML ID of element to use as file input, or the element itself.
   * @returns {HTMLDivElement | undefined} THe HTMLDivElement containing the new input element if created, or undefined if no element was created.
   */
  setupInput(id) {
    if (id && id.length > 0) {
      let input =
        id instanceof HTMLInputElement ? id : document.getElementById(id);
      if (input) {
        input.addEventListener("change", () => {
          if (input.files.length == 1) {
            this.uploadFile(input.files[0]);
          }
        });
      } else {
        throw new ReferenceError("Element " + id + " does not exist!");
      }
    } else {
      const thisScript = document.currentScript;
      const inputElement = this.#fromHTML(
        `<input type="file" width="0" height="0" style="width: 0px; height: 0px; position: absolute; left: 0px; top: 0px; opacity: 0;" title="Upload .isl File" id="isl-loader-file-upload" accept=".isl">`
      );
      const labelElement = this.#fromHTML(
        `<label for="isl-loader-file-upload" id="isl-loader-file-upload-label">Upload <code>.isl</code> File</label>`
      );
      const styleElement = this.#fromHTML(
        `<style>
            #isl-loader-file-upload{
              opacity: 0%;
              width: 0px;
              height: 0px;
              position: absolute;
              left: 0px;
              top: 0px;
            }
            #isl-loader-file-upload-label{
              background-color: black;
              color:aqua;
              padding: 3px;
              outline: 2px solid;
              
              font-family: 'Courier New', Courier, monospace;
            }
            #file-upload-label:hover{
              background-color: #414141;
            }
          </style>`
      );
      const divElement = document.createElement("div");
      divElement.append(styleElement);
      divElement.append(labelElement);
      divElement.append(inputElement);
      thisScript.insertAdjacentElement("afterend", divElement);
      thisScript.insertAdjacentHTML(
        "afterend",
        "<!-- File Input injected by ISL File Loader -->"
      );
      return divElement;
    }
  }
  uploadFile(file) {
    let fileName = file.name.split(".");
    let extension = fileName[fileName.length - 1];
    if (extension == "isl") {
      console.time("Loaded file in");
      const self = this;
      const reader = new FileReader();
      reader.onload = function (e) {
        const text = e.target.result;
        const textByLine = text.split("\n");
        console.timeEnd("Loaded file in");
        self.#loaded = true;
        self.#isl = textByLine;
        if (self.runOnLoad) {
          if (self.#isl != [] && self.#interpreter) {
            self.#interpreter.loadISL(self.#isl, file.name);
            self.#interpreter.run();
          }
        }
      };
      reader.readAsText(file);
    } else {
      throw new Error(
        "Incorrect file extension: expected .isl, got ." + extension
      );
    }
  }
  /**
   * Loads a file from relative path or URL. Can load non-ISL files.
   * @param {String | URL} filePath File path to load from, or URL to get file from.
   */
  fetchFile(filePath) {
    const self = this;
    console.time("Loaded file in");
    fetch(filePath) //text.txt
      .then((response) => response.text())
      .then((text) => {
        const textByLine = text.split("\n");
        console.timeEnd("Loaded file in");
        self.#loaded = true;
        self.#isl = textByLine;
        if (self.runOnLoad) {
          if (self.#isl != [] && self.#interpreter) {
            self.#interpreter.loadISL(self.#isl, filePath);
            self.#interpreter.run();
          }
        }
      });
  }
  getISLArray() {
    return this.#isl;
  }
  /**
   * Sets up auto-run on an interpreter.
   * This runs the ISL instantly on load, on the specified interpreter.
   * Call before `setupInput`.
   * @param {ISLInterpreter} interpreter
   */
  setupAutoRun(interpreter) {
    this.runOnLoad = true;
    this.#interpreter = interpreter;
  }
  /**
   * @param {String} HTML representing a single element.
   * @param {Boolean} flag representing whether or not to trim input whitespace, defaults to true.
   * @returns {Element | HTMLCollection | null}
   */
  #fromHTML(html, trim = true) {
    // Process the HTML string.
    html = trim ? html.trim() : html;
    if (!html) return null;

    // Then set up a new template element.
    const template = document.createElement("template");
    template.innerHTML = html;
    const result = template.content.children;

    // Then return either an HTMLElement or HTMLCollection,
    // based on whether the input HTML had one or more roots.
    if (result.length === 1) return result[0];
    return result;
  }
}

export { ISLFileLoader };
