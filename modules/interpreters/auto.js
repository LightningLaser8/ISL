import { ISLInterpreter } from "../../core/interpreter.js";
import { ISLFileLoader } from "../loader/isl-loader.js";
/*
 _______     ______     __
|__   __|   /  __  \   |  |
   | |     |  |  \_/   |  |
   | |      \  \__     |  |
   | |       _\__ \    |  |
 __| |__    / \__| \   |  |____
|_______|   \______/   |_______|

>> Integrate Scripting Language <<

Concise way to load and execute ISL.
*/

/** Import and run ISL with one function call. Can load local files or add a file input. Only exists to make a more concise way to create an interpreter with a loader. */
class AutoInterpreter extends ISLInterpreter {
  /** `ISLFileLoader` to load files with. */
  #fileLoader;
  /**
   * @extends ISLInterpreter
   * @see {@linkcode ISLInterpreter} for option parameters
   * @param {object} options Options to pass in to the `ISLInterpreter`.
   */
  constructor(options) {
    super(options);
    this.#fileLoader = new ISLFileLoader();
    this.#fileLoader.setupAutoRun(this);
  }
  /**@see {@linkcode ISLFileLoader.fetchFile} */
  runFile(file) {
    this.#fileLoader.fetchFile(file);
  }
  /**@see {@linkcode ISLFileLoader.setupInput} */
  inputFile(name) {
    this.#fileLoader.setupInput(name);
  }
}
export { AutoInterpreter };
