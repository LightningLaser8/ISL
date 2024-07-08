/*
 _______     ______     __
|__   __|   /  __  \   |  |
   | |     |  |  \_/   |  |
   | |      \  \__     |  |
   | |       _\__ \    |  |
 __| |__    / \__| \   |  |____
|_______|   \______/   |_______|

[Infinity] Interpreted Sequence Language

Extension API.
Extensions can provide keywords, labels, variables and types to an ISL interpreter.
*/
/**
 * An ISL extension. Provides a set of custom keywords, variables and types to an interpreter when imported.
 */
class ISLExtension{
  #keywords = {}
  #variables = {}
  #types = {}
  #labels = []
  #identifier = ""
  /**
   * @param {String} id Identifier for the extension, used in ISL meta tags for dependency
   */
  constructor(id){this.#identifier = id}// oh, come onnnnn
  /**  */
  get types(){return this.#types}
  get labels(){return this.#labels}
  get keywords(){return this.#keywords}
  get variables(){return this.#variables}
  get id(){return this.#identifier}
  /**
   * Adds a keyword. Has the same functionality as as `ISLInterpreter.defineISLKeyword()`.
   * @param {string} name The name of the keyword. What the interpreter should look out for.
   * @param {Function} callback Function to execute. Inputs are given as an array. Has the same rules as `ISLInterpreter.defineISLKeyword`'s `options.callback` parameter.
   */
  addKeyword(name, callback){
    const obj = {callback: callback}
    this.#keywords[name] = obj
  }
  /**
   * Adds a variable to be turned into a global variable on import.
   * @param {string} name The name of the global variable. What the interpreter should look out for.
   * @param {any} value Initial value of the variable.
   * @returns the ISL variable object created, for further use
   */
  addVariable(name, value){
    const obj = {value: value, type: typeof value}
    this.#variables[name] = obj
    return obj
  }
  /**
   * Adds a label for keywords.
   * @param {string} name The name of the label. What the interpreter should look out for.
   * @param {Array<string>} wordsFor Keywords this label is for.
   */
  addLabel(name, wordsFor){
    const obj = {label: name, for: [...wordsFor]}
    this.#labels.push(obj)
  }
}

export default ISLExtension
