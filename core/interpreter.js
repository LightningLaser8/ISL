/*
 _______     ______     __
|__   __|   /  __  \   |  |
   | |     |  |  \_/   |  |
   | |      \  \__     |  |
   | |       _\__ \    |  |
 __| |__    / \__| \   |  |____
|_______|   \______/   |_______|

[Infinity] Interpreted Sequence Language

General interpreter for web-env based ISL, can give callback functionality to custom keywords.
Has a custom error handler to give better information about ISL errors and their cause
*/


//ISL Interface
/**
 * General interpreter to run ISL code with. Runs by default in the environment `js`.
 */
class ISLInterpreter{
  static #deprecated = {
    webprompt: {replacements: ["'popup-input'"], type: "renamed", display: "'webprompt'"},
    declare: {replacements: ["'string'", "'function'", "'number'"], type: "split", display: "'declare var/cmd'"}
  }
  #warnedFor = []

  environment = "js"

  //ISL meta
  #meta = {}
  #ignored = [] //reset this when file changes?

  //Execution
  #isl = []
  #filename = "<direct execution>"
  #realFilename = "s"
  #loaded = false
  #counter = 0
  #lastErrorLine = 0
  #stopped = false
  #executor

  //Vars
  #localVariables = {}
  #globalVariables = {
    //Mouse variables
    mleft: {value: 0, type: "number"},
    mright: {value: 0, type: "number"},
    mwheel: {value: 0, type: "number"},
    m4: {value: 0, type: "number"},
    m5: {value: 0, type: "number"},
    many: {value: 0, type: "number"}
  } //These cannot be changed by ISL, they're like constants but custom keywords and events can change them.
  #functions = {}
  #parameters = {}
  #callstack = []


  static #ISLConsole = class ISLConsole extends Array{
    log(...msg){
      this.push(...msg)
    }
    warn(...msg){
      this.push(...msg)
    }
    error(...msg){
      this.push(...msg)
    }
  }

  //IO
  #console = new ISLInterpreter.#ISLConsole()

  //Listeners, i guess
  #listeningForKeyPress = false
  #listenerTarget
  #listenerManipulationType
  #pressed = {}
  #mouseButtonsPressed = 0
  static mouseButtons = ["left", "right", "wheel", "back", "forward"];

  //Custom keywords and extensions
  #customKeywords = {}
  #extensions = []
  get #customLabels(){
    let labels = []
    for(let ext of this.#extensions){
      labels.push(...ext.labels)
    }
    return labels
  }

  //Labels
  static #labels = [
    {label: "non-destructive", for: ["restart"]},
  ]
  #currentLabels = []

  //Flow control
  #waits = 0
  #skipping = false

  //Options
  options
  #showExecutionTime
  #silenced
  #debug
  #groupConsoleMessages
  #name
  #timestamp
  #allowCommunicationDefault
  #reportErrors
  #instant
  #instructionsAtOnce
  haltOnDisallowedOperation
  #tagMessages

  //Security
  allowExport = true
  allowImport = true

  //oh god
  #staticTypes = true

  //Callbacks
  #onerror = (error, defaultHandler) => {defaultHandler(error)}
  #onwarn = (warning) => {this.#defaultWarn(warning)}
  #onlog = (...msg) => {this.#defaultLog(...msg)}

  /**
   * @param {Object} options Options to run with. All fields are optional.
   * @param {String} options.name Display name for log messages. Can be left blank. Defaults to "<unnamed interpreter>".
   * @param {String} options.environment Environment to execute in. Default "js".
   * @param {Boolean} options.showExecutionTime Whether or not to display execution time on end. Default false.
   * @param {Boolean} options.silenced Whether or not to hide log outputs. Does not affect error messages. Default false.
   * @param {Boolean} options.debug Whether or not to display extended log messages. Default false.
   * @param {Boolean} options.tagMessages Whether or not to tag log messages with the interpreter's name. Default false.
   * @param {Boolean} options.groupConsoleMessages Whether or not to group log/debug/error messages in the console. Default false.
   * @param {Boolean} options.timestamp Whether or not to show date and time ISL execution started, either in the group name, or in debug messages. Default false.
   * @param {Boolean} options.allowCommunicationDefault The default for allowExport and allowImport. Default false.
   * @param {Boolean} options.reportErrors Whether or not to log error messages on crash. Default true.
   * @param {Boolean} options.instant Whether or not to run all loaded ISL at once. May crash from infinite loops. Default false.
   * @param {Number} options.instructions How many instructions to run at a time. Default 1.
   * @param {Boolean} options.bufferedGraphics Whether or not to add graphics to a buffer array, then draw them all at once with the `draw` keyword. When disabled, graphics may flicker slightly. Default true.
   * @param {Boolean} options.disallowIndependentGraphics Whether or not to disallow canvas operations. Default false.
   * @param {Boolean} options.haltOnDisallowedOperation Whether or not to stop execution when a disallowed instruction is executed. Default false.
   * 
   * @param {(error: string, defaultHandler: (error: string) => {}) => {}} options.onerror Callback for any errors from ISL code. Can invoke the default error handler through the second parameter. The error is given as a STRING holding the message, not the error object.
   * @param {(warning: string[]) => {}} options.onwarn Callback for any warnings.
   * @param {(msg: string[]) => {}} options.onlog Callback for any log messages, including ones from ISL code and internally.
   */
  constructor(options = {}){
    this.options = options
    this.#name = options?.name ?? "<unnamed interpreter>"
    this.environment = options?.environment ?? "js"
    this.#showExecutionTime = options?.showExecutionTime ?? false
    this.#silenced = options?.silenced ?? false
    this.#debug = options?.debug ?? false
    this.#tagMessages = options?.tagMessages ?? false
    this.#groupConsoleMessages = options?.groupConsoleMessages ?? false
    this.#timestamp = options?.timestamp ?? false
    this.#allowCommunicationDefault = options?.allowCommunicationDefault ?? false
    this.#reportErrors = options?.reportErrors ?? true
    this.#instant = options?.instant ?? false
    this.#instructionsAtOnce = options?.instructions ?? 1
    this.haltOnDisallowedOperation = options?.haltOnDisallowedOperation ?? false
    this.allowExport = this.allowImport = this.#allowCommunicationDefault

    addEventListener("keydown", event => {this.#handleKey.apply(this, [event, this.#listenerTarget, this.#listenerManipulationType]); this.#keyDown(event) })
    addEventListener("keyup", event => {this.#keyUp(event)})
    addEventListener("mousedown", event => this.#handleClick(event))
    addEventListener("mouseup", event => this.#handleClick(event))

    this.#onerror = options.onerror ?? this.#onerror
    this.#onwarn = options.onwarn ?? this.#onwarn
    this.#onlog = options.onlog ?? this.#onlog
  }
  /**
   * @param {MouseEvent} event 
   */
  #handleClick(event){
    this.#mouseButtonsPressed = event.buttons??0
    this.#globalVariables.mleft.value = this.#isMouseButtonPressed("left")?1:0
    this.#globalVariables.mright.value = this.#isMouseButtonPressed("right")?1:0
    this.#globalVariables.mwheel.value = this.#isMouseButtonPressed("wheel")?1:0
    this.#globalVariables.m4.value = this.#isMouseButtonPressed("back")?1:0
    this.#globalVariables.m5.value = this.#isMouseButtonPressed("forward")?1:0

    this.#globalVariables.many.value = (event.buttons > 0)?1:0
  }

  #isMouseButtonPressed(buttonName) {
    return Boolean(this.#mouseButtonsPressed & (1 << ISLInterpreter.mouseButtons.indexOf(buttonName)));
  }

  #handleError(error){
    this.#lastErrorLine = this.#pc
    this.stopExecution();
    if(this.#reportErrors){
      this.#error(
        this.#nameString+" "+
        ((error instanceof ISLError)?
        ("Error detected; execution halted\n"+
        (error.message.length > 0?error.message:"(No message provided)")+"\n  -> line "+this.#lastErrorLine+" in "+this.#filename+
        "\nDetails: \n  Error Type: "+(error.type?.name??"unknown")+
        "\n  Stacktrace: \n"+ this.#stacktrace+
        "\n\nRun with options.reportErrors = false to hide this and all further errors from this interpreter"):
        error instanceof Error?
        ("Error detected; execution halted\n"+
          "Internal "+error.constructor.name+"\nwhile running line "+this.#lastErrorLine+" in "+this.#filename+":"+
          "\n "+(error.message.length > 0?"'"+error.message+"'":"(No message provided)")+
          "\nDetails: \n  Error Type: "+error.constructor.name+
          "\n  Interpreter Stacktrace:\n"+ error.stack.split("\n").slice(1).join("\n"))+
          (this.#extensions.length > 0?"\n  Installed Extensions:\n   - "+ this.#extensions.map(x => x.id + " ("+(x.source??"unknown source")+")").join("\n   - ")+
          "\n\nCheck if an extension is causing your problem. If so, try opening an issue on their page, or contacting their support."
          :"\n  No extensions installed")+
          "\n\nIf that doesn't work, or it's not caused by an extension, open an issue at https://github.com/LightningLaser8/ISL/issues to get this fixed.":error)
      )
    }
  }

  #handleDeprecatedFeature(feature, type){
    if(!ISLInterpreter.#deprecated.hasOwnProperty(feature)) return false;
    const featObj = ISLInterpreter.#deprecated[feature]
    this.#warnOnce("df:"+feature+":"+type, "Deprecated feature used: "+featObj.display+" ("+type+", line "+this.#pc+")"+"\nFeature has been "+featObj.type+".\n"+(featObj.replacements?(featObj.replacements.length > 1?("Use "+featObj.replacements.slice(0, -1).join(", ")+" or "+featObj.replacements.at(-1)+" instead."):"Use "+featObj.replacements[0]+" instead."):"Do not use."))
    return true;
  }

  #warnOnce(warnID, ...msg){
    if(this.#warnedFor.includes("."+warnID+"|"+this.#pc)) return;
    this.#warn(...msg)
    this.#warnedFor.push("."+warnID+"|"+this.#pc)
    if(this.#debug){
      console.log("warning ID|line: "+this.#warnedFor)
    }
  }

  #callErrorCallback(error){
    this.#onerror(error, (error) => {console.error(error)})
  }

  get #keysDown(){
    return this.#pressed
  }
  get #pc(){
    return this.#counter + 1
  }
  set #pc(newPC){
    this.#counter = newPC - 1
  }
  get #currentLine(){
    if(!this.#loaded){return null}
    return this.#isl[this.#counter]
  }
  get #erroredLine(){
    if(!this.#loaded){return null}
    return this.#isl[this.#lastErrorLine - 1]
  }
  get #nameString(){
    return this.#tagMessages?this.#name + (this.#name?":":""):""
  }
  get #stacktrace(){
    let stack = [
      "  -> on '"+(this.#name)+"' ("+this.constructor.name+")",
      "  -> in file '"+this.#filename+"'"+(this.#realFilename?(" ("+this.#realFilename+")"):"")
    ]
    for(let item of this.#callstack){
      stack.push("  -> in '"+item.func+"' [line "+item.calledFrom+"]")
    }
    stack.push(" -> executing '"+this.#erroredLine+"' [line "+this.#lastErrorLine+"]")
    return stack.reverse().join("\n")
  }
  get #isWaiting(){
    if(this.#listeningForKeyPress){
      return true
    }
    if(this.#waits > 0){
      this.#waits --
      return true
    }
  }
  get [Symbol.toStringTag]() {
    return 'ISLInterpreter';
  }
  *[Symbol.iterator]() {
    for(let isl of this.#isl){
      yield isl
    }
  }
  #handleDisallowedOperation(...msg){
    let aaa = ""
    if(this.haltOnDisallowedOperation){
      this.stopExecution()
      aaa = ("| Execution halted")
    }
    this.#warn("Disallowed Operation:", ...msg, aaa)
  }

  #keyDown(event){
    this.#pressed[event.key] = true
  }
  #keyUp(event){
    delete this.#pressed[event.key]
  }
  
  /**
   * Logs the entire internal output console to the JS one.
   */
  #flush(){
    this.#log(...this.#console)
    this.#console = []
  }
  /**
   * Logs the entire internal output console to the JS one in lines.
   */
  #flushSeparate(){
    let len = this.#console.length
    for(let m = 0; m < len; m++){
      this.#log(this.#console[0])
      this.#console.splice(0, 1)
    }
  }
  /**
   * Loads ISL into the interpreter's buffer.
   * @param {Array<String>} array Array of ISL lines as strings.
   * @param {String} source Name of the source of the ISL. Used for error reporting.
   */
  loadISL(array, source){
    this.#isl = array
    this.#loaded = true
    this.#counter = 0
    if (source) {this.#filename = source; this.#realFilename = ""}
    if(this.#debug){
      this.#log("ISL loaded")
    }
  }
  #executeISL() {
    if(!this.#isWaiting && !this.#stopped){
      if(this.#isl){
        if(this.#debug){
          this.#log(this.#counter)
        }
        if(this.#isl[this.#counter] || this.#isl[this.#counter] == ""){
          this.#executeLineInternal(this.#isl[this.#counter])
          this.#counter ++
          if(this.#pc > this.#isl.length){
            this.#reset()
          }
        }
        else{
          if(this.#debug){
            this.#log("Nothing here!")
          }
          this.#reset()
        }
      }
      else{
        throw new ISLError("No ISL defined for execution", Error)
      }
    }
  }
  #executeAllISL() { //Warning: awaitkey and delay don't want to work with this.
    this.#reset()
    for(this.#counter = 0; this.#counter < this.#isl.length; this.#counter ++){
      if(!this.#isWaiting && !this.#stopped){
        if(this.#isl){
          if(this.#debug){
            this.#log(this.#counter)
          }
          if(this.#isl[this.#counter]){
            this.#executeLineInternal(this.#isl[this.#counter])
            //this.#counter ++
          }
          else{
            this.#reset()
            throw new ISLError("Empty ISL elements are not allowed in executeAllISL", SyntaxError)
          }
        }
        else{
          throw new ISLError("No ISL defined for execution", Error)
        }
      }
    }
  }
  /**
   * Starts execution of loaded ISL with a specified speed and IPT.
   * @param {Number} speed Number of milliseconds between each execution 'tick'.
   * @param {Number} ipt IPT, or 'instructions per tick', to run.
   */
  startExecution(speed = 10, ipt = this.#instructionsAtOnce){
    this.executeSpeed = speed
    this.#instructionsAtOnce = ipt
    if(this.#debug){
      this.#log("Executing at "+Math.round((1000/speed*this.#instructionsAtOnce)*100)/100 + " instructions per second")
    }
    if(this.#showExecutionTime){
      console.time(this.#nameString + "Execution time")
    }
    if(this.#groupConsoleMessages){
      console.group(this.#nameString + "ISL Execution"+ (this.#timestamp?(" | " + new Date().toUTCString()):""))
    }
    this.#stopped = false
    this.#executor = setInterval(
      ()=>{
        try{
          if(this.#instant){
            this.#executeAllISL()
          }
          else{
            for(let i = 0; i < this.#instructionsAtOnce; i ++){
              this.#executeISL()
            }
          }
        }
        catch(error){
          this.#handleError(error)
        }
      }
      ,speed)
  }
  /**
   * Starts execution of loaded ISL with the default or current speed.
   */
  run(){
    this.startExecution(this.executeSpeed)
  }
  /**
   * Stops execution of loaded ISL. Resets counter and local variables.
   */
  stopExecution(){
    this.#stopped = true
    if(this.#showExecutionTime){
      console.timeEnd(this.#nameString + "Execution time")
    }
    if(this.#debug){
      this.#log("Execution halted")
    }
    if(this.#groupConsoleMessages){
      console.groupEnd()
    }
    clearInterval(this.#executor)
    this.#hardReset()
  }
  #stopExecutionDestructive(){
    this.#stopped = true
    if(this.#showExecutionTime){
      console.timeEnd(this.#nameString + "Execution time")
    }
    if(this.#debug){
      this.#log("Execution halted")
    }
    if(this.#groupConsoleMessages){
      console.groupEnd()
    }
    clearInterval(this.#executor)
    this.#reset()
  }
  /**
   * Pauses execution of loaded ISL.
   */
  pauseExecution(){
    this.#stopped = true
    clearInterval(this.#executor)
    if(this.#debug){
      this.#log("Execution paused")
    }
  }
  /**
   * Removes the comment section of an ISL line.
   * @param {String} line ISL line to remove comment from
   * @returns {String} Line without the comment
   */
  static #removeISLComment(line){
    let parts = []
    parts = line.split("//")
    return parts[0]
  }
  /**
   * Separates a line of ISL into parts.
   * @param {String} line ISL line to separate
   * @returns {Array<string>} Array containing separated parts.
   */
  #separateISLParts(line){
    let parts = []
    if(this.#debug){
      this.#log(line)
    }
    parts = line.split(" ")
    return parts
  }
  /**
   * Executes a line of ISL.
   * @param {String} line ISL line to execute
   */
  executeLine(line){
    try {
      this.#executeLineInternal(line)
    } catch (error) {
      this.#handleError(error)
    }
  }
  #executeLineInternal(line){
    exe: if(line != null && line != undefined && line != "" && line != "\n"){
      if(line.trim().match(/^\[.*\]$/)){
        this.#parseMeta(line)
        break exe
      }
      let noComment = ISLInterpreter.#removeISLComment(line).trim().replaceAll(/[🟥🟧🟨🟩🟦🟪]/g, "")
      if(noComment != null && noComment != undefined && noComment != "" && noComment != "\n"){
        //Fix string literals
        let fixed = noComment.replaceAll(/\"[^\"]*\"/g, x => { //String Literals
          return (x
            //Add special characters here
            .replaceAll("\\", "🟥")
            .replaceAll(" ", "🟧")
            .replaceAll("[", "🟨")
            .replaceAll("]", "🟩")
            .replaceAll(":", "🟪")
          )
        }).replace(/\"/g, "")
        let parts = this.#separateISLParts(fixed)
        {
          if(this.#debug){
            this.#log(parts)
          }
          //Variable references
          for(let p = 0; p < parts.length; p++){
            //Remove trailing spaces
            parts[p] = parts[p].trim()
            
            //References
            if(!this.#skipping){ // Don't care if only skimming to find the end of a function
              let part = parts[p]
              //Global variable references
              {
                let newPart = part.replaceAll(/\\\_[^\\]*\\/g, x => {
                  let nam = x.substring(2, x.length - 1)
                  let v
                  if(this.#globalVariables[nam]){
                    v = this.#globalVariables[nam].value
                  }
                  else{
                    throw new ISLError("Global variable '"+nam+"' does not exist!", ReferenceError)
                  }
                  return v
                })
                parts[p] = newPart
              }
              part = parts[p]
              {
                //Explicit parameter references
                let newPart = part.replaceAll(/:\\[^\\]*\\/g, x => {this.getParameter(x.substring(2, x.length - 1))})
                parts[p] = newPart
              }
              part = parts[p]
              {
                //Explicit local variable references
                let newPart = part.replaceAll(/-\\[^\\]*\\/g, x => {this.getVar(x.substring(2, x.length - 1))})
                parts[p] = newPart
              }
              //Local variable or parameter references
              part = parts[p]
              {
                let newPart = part.replaceAll(/\\[^\\]*\\/g, x => {
                  let nx = null;
                  if(this.#callstack.length > 0){
                    try{nx =  this.getParameter(x.substring(1, x.length - 1))}
                    catch(e){
                      nx = this.getVar(x.substring(1, x.length - 1))
                    }
                  }
                  else{
                    nx = this.getVar(x.substring(1, x.length - 1))
                  } 
                  return nx
                })
                parts[p] = newPart
              }
            }
            //Add special chars back
            parts[p] = parts[p].
              replaceAll("🟧", " ").
              replaceAll("🟥", "\\").
              replaceAll("🟨", "[").
              replaceAll("🟩", "]").
              replaceAll("🟪", ":")
            //Parse numbers
            parts[p] = ISLInterpreter.#tryToNum(parts[p])
          }
          this.#currentLabels = []
          this.#executeStatement(parts)
        }
      }
    }
  }
  #parseMeta(metaTag){
    let meta = metaTag.substring(1, metaTag.length-1)
    let parts = meta.split(" ")
    let [tag, value] = [parts[0], parts.slice(1).join(" ")]
    if(tag === "require"){
      if(!this.#hasExtensionWithId(value)){
        throw new ISLError("Required extension '"+value+"' is not present", EnvironmentError)
      }
    }
    if(tag === "ignore"){
      if(!this.#ignored.includes(value)){
        this.#ignored.push(...value.split(" "))
      }
    }
    if(tag === "environment" || tag === "env"){
      if(this.environment != value){
        throw new ISLError("Incorrect environment for operation: File requires '"+value+"', got '"+this.environment+"'", EnvironmentError)
      }
    }
    if(tag === "display"){
      if(typeof value === "string" && value.length > 0){
        this.#realFilename = this.#filename
        this.#filename = value
      }
      else{
        throw new ISLError("Display name must be a non-empty string", SyntaxError)
      }
    }
  }
  /**
   * Checks if a variable exists in this interpreter.
   * @param {*} varName Name to search for.
   * @returns {Boolean} True if variable exists, false if not.
   */
  #doesVarExist(varName){
    return this.#localVariables[varName] != undefined
  }
  #doesFuncExist(varName){
    return this.#functions[varName] != undefined
  }
  #hasVarBeenDeclaredInCurrentRun(varName){
    return this.#localVariables[varName].declared
  }
  #hasFuncBeenDeclaredInCurrentRun(varName){
    return this.#functions[varName].declared
  }
  /**
   * Gets variable value from declared name. Throws an error if it doesn't exist.
   * @param {String} varName Variable name to search for.
   * @returns {Number|String} The value of the variable object corresponding to the name
   */
  getVar(varName){
    if(this.#localVariables[varName] != null){
      return this.#localVariables[varName].value
    }
    throw new ISLError("Variable '"+varName+"' does not exist!", ReferenceError)
  }
  /**
   * Gets parameter value from declared name. Throws an error if it doesn't exist.
   * @param {String} varName Parameter name to search for.
   * @returns {Number|String} The value of the object corresponding to the name
   */
  getParameter(varName){
    if(this.#parameters[varName] != null){
      return this.#parameters[varName].value
    }
    throw new ISLError("Parameter '"+varName+"' does not exist!", ReferenceError)
  }

  toParameterObjects(func, parameters){
    if(this.#debug){
      console.log("Input: function:",func,"parameters:",parameters)
    }
    if(func === "") return;
    let paramTypes = this.#getFunction(func).params.types
    let paramNames = this.#getFunction(func).params.names
    if(this.#debug){
      console.log("Expected: names:",paramNames,"types:",paramTypes)
    }
    //Convert array to read-only variable shit
    let params = {}
    if(this.#debug){
      console.log("parsing",parameters.length,"parameters")
    }
    if(parameters.length !== paramNames.length){
      throw new ISLError("Function '"+func+"' requires "+paramNames.length+" parameter(s), but received "+parameters.length, SyntaxError)
    }
    for(let p = 0; p < parameters.length; p++){
      let parameter = parameters[p]
      if(this.#debug){
        console.log("parameter index",p,"=>",parameter)
      }
      if(paramTypes[p] !== typeof parameter){
        throw new ISLError("Parameter '"+paramNames[p]+"' has type '"+paramTypes[p]+"', but was given an argument of type '"+typeof parameter+"'", TypeError)
      }
      Object.defineProperty(params, paramNames[p], {
        value: {
          type: typeof parameter,
          value: parameter
        }
      })
      if(this.#debug){
        console.log("new parameter",params[paramNames[p]])
      }
    }
    return params
  }

  setVar(varName, value){
    if(this.#localVariables[varName] != null){
      this.#localVariables[varName].value = value
    }
    else{
      throw new ISLError("Variable '"+varName+"' does not exist!", ReferenceError)
    }
  }
  /**
   * Gets function from declared name. Throws an error if it doesn't exist.
   * @param {String} funcName Function name to search for.
   * @returns {object} The function object corresponding to the name
   */
  #getFunction(funcName){
    if(this.#functions[funcName] != null){
      return this.#functions[funcName]
    }
    throw new ISLError("Function '"+funcName+"' does not exist!", ReferenceError)
  }

  /**
   * Gets variable object from declared name. Throws an error if it doesn't exist.
   * @param {String} varName Variable to search for.
   * @returns {object} The variable object corresponding to the name
   */
  #getVarObj(varName){ //
    if(this.#localVariables[varName] != null){
      return this.#localVariables[varName]
    }
    throw new ISLError("Variable '"+varName+"' does not exist!", ReferenceError)
  }
  /**
   * Resets the interpreter to the start. Soft resets all local variables.
   */
  #reset(){
    this.#counter = 0
    for(let vname in this.#localVariables){
      let v = this.#localVariables[vname]
      if(v){
        v.declared = false
      }
    }
    for(let fname in this.#functions){
      let f = this.#functions[fname]
      if(f){
        f.declared = false
      }
    }
  }
  /**
   * Resets the interpreter to the start. Removes all local variables.
   */
  #hardReset(){
    this.#counter = 0
    this.#localVariables = {}
    this.#functions = {}
  }
  /**
   * Tries to parse the input as a number.
   * @param {*} thing 
   * @returns {Number | *} The input as a number, if applicable. If not, returns the original input.
   */
  static #tryToNum(thing){
    let test = parseFloat(thing)
    if(isNaN(test) || test != thing){
      return thing
    }
    else{
      return test
    }
  }
  #log(...msg){
    this.#onlog(...msg)
  }
  /**
   * Sends a message to the log handler. Affected by options.silenced, and (by default) prefixes the message with the interpreter's name.
   * @param {*[]} msg 
   */
  log(...msg){
    if(!this.#silenced){
      this.#log(...msg)
    }
  }
  #defaultLog(...msg){
    if(!this.#silenced){
      console.log(this.#nameString, ...msg)
    }
  }
  #warn(...msg){
    if(!this.#silenced){
      this.#onwarn(...msg)
    }
  }
  /**
   * Sends a warning to the warning handler. Affected by options.silenced, (by default) and prefixes the message with the interpreter's name.
   * @param {*[]} msg 
   */
  warn(...msg){
    this.#warn(...msg)
  }
  #defaultWarn(...msg){
    if(!this.#silenced){
      console.warn(this.#nameString, ...msg)
    }
  }
  #error(msg){
    this.#callErrorCallback(msg)
  }
  /**
   * Sends an error to the error handler. Affected by options.silenced. Default stacktrace includes the interpreter's name. For ISL code error handling, use ISLError. For internal errors, use any other Error.
   * @param {Error | string} msg 
   */
  error(msg){
    this.#handleError(msg)
  }
  #handleKey(event, variable, type = "set"){
    if(this.#listeningForKeyPress){
      switch(type){
        case "set":
          this.#isl_set(variable, event.key)
          break;
        case "add":
          this.#isl_add(variable, event.key)
          break;
      }
      
      if(this.#debug){
        this.#log("Key recieved: "+event.key)
      }
      this.#listeningForKeyPress = false
    }
  }
  #operate(val1, operator, val2){
    if(this.#debug){
      this.#log(val1 + " " + operator + " " + val2)
    }
    switch(operator){
      case "=":
        return val1 == val2
      case "<":
        return val1 < val2
      case ">":
        return val1 > val2
      case "!=":
        return val1 != val2
      case "in":
        if(/^\[[^\[\]]*\]$/.test(val2)){
          if(this.#debug) console.log("group test:",val1,"in",val2.replaceAll("🟦", " "))
          return val2.substring(1, val2.length - 1).split("|").includes(val1)
        }
        return new RegExp(val1, "g").test(val2)

      default:
        throw new ISLError("Operator '"+operator+"' is not recognised.", SyntaxError)
    }
  }
  #getVariableFromFullPath(path){
    return this.#getVarValueFromString(globalThis, path)
  }
  #setVariableFromFullPath(path, value){
    let xedPath = path.trim().replace(";", " ").replace("}", " ").replace("{", " ").replace("]", " ").replace("[", " ").replace(")", " ").replace("(", " ").replace("=", " ")
    let xedVal = (typeof value === "string") ? value.trim().replace(";", " ").replace("}", " ").replace("{", " ").replace("]", " ").replace("[", " ").replace(")", " ").replace("(", " ").replace("=", " "): value
    let val = (typeof ISLInterpreter.#tryToNum(xedVal) === "number")?xedVal:"\""+xedVal+"\""
    let f = new Function(xedPath + "=" + val)
    f() //fix possible security vulnerability
  }
  #getVarValueFromString(obj, path){
    let currentObject = obj
    let parts = path.split('.')
    let depth = parts.length
    for (let i = 0; i < depth; i++){
      currentObject = currentObject[parts[i]];
    };
    return currentObject;
  };

  /**
   * Executes an ISL statement from an array of parts.
   * @param {Array<string>} statementArray 
   */
  #executeStatement(statementArray){
    let parts = statementArray
    if(this.#debug){
      this.#log(parts)
      this.#log(this.#localVariables)
    }
    if(this.#ignored.includes(parts[0])){
      if(this.#debug){
        this.#log(parts[0], "was ignored")
      }
      return;
    }
    while(ISLInterpreter.#isLabel(parts[0]) || this.#isOwnLabel(parts[0]) && parts[1] !== undefined){
      this.#currentLabels.push(parts[0])
      if(this.#debug){
        this.#log(parts[0], "is label")
      }
      parts = parts.slice(1)
    }
    for(let l of this.#currentLabels){
      if(!(ISLInterpreter.#isLabelFor(l, parts[0]) || this.#isOwnLabelFor(l, parts[0]))){
        throw new ISLError("Label '"+l+"' is not applicable to '"+parts[0]+"'", SyntaxError)
      }
    }
    if(this.#skipping){
      if(this.#debug){
        this.#log("*skipped due to function declaration")
      }
      if(parts[0] === "end"){
        this.#isl_end(parts[1], parts[2])
        this.#skipping = false
      }
    }
    else{
      if(this.#handleDeprecatedFeature(parts[0], "keyword")) return;
      //Variable Creation
      if(parts[0] === "declare"){
        this.#isl_declare(parts[1], parts[2])
      }
      else if(parts[0] === "var"){
        this.#isl_declare("var", parts[1])
      }
      else if(parts[0] === "number"){
        this.#isl_declare("var", parts[1], 0, "number")
      }
      else if(parts[0] === "string"){
        this.#isl_declare("var", parts[1], "", "string")
      }
      else if(parts[0] === "function"){
        this.#isl_declare("cmd", parts[1], undefined, "function", parts.slice(2))
      }
      //Variable go bye-bye
      else if(parts[0] === "delete"){
        this.#isl_delete(parts[1])
      }
      //Functions
      else if(parts[0] === "end"){
        this.#isl_end(parts[1], parts[2])
      }
      else if(parts[0] === "execute"){
        this.#isl_execute(parts[1], ...parts.slice(2))
      }
      //Variable Manipulation
      else if(parts[0] === "set"){
        this.#isl_set(parts[1], parts[2])
      }
      else if(parts[0] === "add"){
        this.#isl_add(parts[1], parts[2])
      }
      else if(parts[0] === "subtract"){
        this.#isl_sub(parts[1], parts[2])
      }
      else if(parts[0] === "multiply"){
        this.#isl_mult(parts[1], parts[2])
      }
      else if(parts[0] === "divide"){
        this.#isl_div(parts[1], parts[2])
      }
      else if(parts[0] === "round"){
        this.#isl_round(parts[1], parts[2])
      }
      else if(parts[0] === "exponent"){
        this.#isl_exp(parts[1], parts[2])
      }
      else if(parts[0] === "root"){
        this.#isl_root(parts[1], parts[2])
      }
      else if(parts[0] === "negate"){
        this.#isl_negate(parts[1])
      }
      //IO
      else if(parts[0] === "log"){
        this.#isl_log(parts[1])
      }
      else if(parts[0] === "flush"){
        if(this.#currentLabels.includes("separated")){
          this.#flushSeparate()
        }
        else{
          this.#flush()
        }
      }
      else if(parts[0] === "popup-input"){
        this.#isl_popup_input(parts[1], parts[2])
      }
      else if(parts[0] === "awaitkey"){
        this.#isl_awaitkey(parts[1], parts[2])
      }
      else if(parts[0] === "getkeys"){
        this.#isl_getkeys(parts[1], parts[2])
      }
      //Flow Control
      else if(parts[0] === "restart"){
        if(this.#currentLabels.includes("non-destructive")){
          this.stopExecution()
        }
        else{
          this.#stopExecutionDestructive()
        }
        this.startExecution(this.executeSpeed)
      }
      else if(parts[0] === "rundelay"){
        ISLInterpreter.validateNum("rundelay", ["delay", parts[1]])
        this.executeSpeed = parts[1] ?? 10
      }
      else if(parts[0] === "stop"){
        this.stopExecution()
      }
      else if(parts[0] === "pause"){
        ISLInterpreter.validateNum("pause", ["timeout", parts[1]])
        this.#waits += parts[1]
      }
      else if(parts[0] === "if"){
        this.#isl_if(parts[1], parts[2], parts[3], parts.slice(4))
      }
      else if(parts[0] === "jump"){
        this.#goToLine(parts[1])
      }
      
      //Program Interface
      else if(parts[0] === "export"){
        this.#isl_export(parts[1], parts[2])
      }
      else if(parts[0] === "import"){
        this.#isl_import(parts[1], parts[2])
      }

      //Custom keywords
      else if(this.#customKeywords[parts[0]] !== undefined){
        const keyword = this.#customKeywords[parts[0]]
        const inputs = parts.slice(1)
        keyword.callback.apply(keyword.source, [this, this.#currentLabels, ...inputs])
      }

      //Error if invalid
      else{
        throw new ISLError("Statement '"+parts[0]+"' not recognised", SyntaxError)
      }
    }
  }


  /**
   * Waits a certain number of milliseconds, then resolves to true.
   * @param {Number} ms Number of milliseconds to delay for.
   * @returns {Promise<Boolean>}\True, after the delay is up.
   */
  #delay = async function(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  #goToLine(line){
    if(line[0] === "~" && typeof ISLInterpreter.#tryToNum(line.substring(1)) === "number"){
      this.#pc = this.#pc + parseInt(line.substring(1)) - 1
    }
    else if(typeof line === "number"){
      this.#pc = parseInt(line) - 1
    }
    else{
      throw new ISLError("Line numbers must be numbers or relative positions.", TypeError)
    }
  }
  //Variable Creation
  #isl_declare(declareType, name, initialValue = null, type, functionParameters = []){
    ISLInterpreter.validateStr("(variable or function declaration)", ["name", name])
    if(declareType === "var"){
      if(type === undefined){
        this.#warnOnce("notype","No type set for variable '"+name+"' (declared line "+this.#pc+")")
      }
      if(this.#doesVarExist(name) && this.#hasVarBeenDeclaredInCurrentRun(name)){
        throw new ISLError("Cannot redeclare local variable '"+name+"'", ReferenceError)
      }
      else{
        this.#localVariables[name] = {value: initialValue, type: type, declared: true}
      }
    }
    else if(declareType === "cmd"){
      if(this.#doesFuncExist(name) && this.#hasFuncBeenDeclaredInCurrentRun(name)){
        throw new ISLError("Cannot redeclare function '"+name+"'", ReferenceError)
      }
      else{
        let paramNames = []
        let paramTypes = []
        for(let param of functionParameters){
          let opts = param.split(":")
          paramNames.push(opts[0])
          paramTypes.push(opts[1])
        }
        if(this.#debug){
          console.log("function declared with parameters",functionParameters,"=> names:",paramNames,"types:",paramTypes)
        }
        this.#functions[name] = {indexStart: this.#counter, declared: true, ended: false, params: {names: paramNames, types: paramTypes}}
        if(this.#debug){
          console.log("function object is now",this.#functions[name])
        }
        this.#skipping = true
      }
    }
    else{
      throw new ISLError("Unknown type: '"+declareType+"', expected 'var' or 'cmd'", SyntaxError)
    }
  }
  //uh, BYE
  #isl_delete(name){
    ISLInterpreter.validateStr("delete", ["variable", name])
    if(!this.#doesVarExist(name)){
      throw new ISLError("Cannot delete nonexistent variable '"+name+"'", ReferenceError)
    }
    else{
      delete this.#localVariables[name]
    }
  }
  //Functions
  #isl_end(name){
    ISLInterpreter.validateStr("end", ["name", name])
    if(!this.#doesFuncExist(name)){
      throw new ISLError("Function '"+name+"' does not exist!", ReferenceError)
    }
    else{
      this.#functions[name].indexEnd = this.#counter

      if(this.#functions[name].ended){
        //return up the callstack
        let previous = this.#callstack.pop() //callstack has {calledFrom: number, func: String, params: Array<String>}
        let continuing = this.#callstack[0] ?? {calledFrom: 0, func: "", params: []}
        this.#counter = previous?.calledFrom ?? this.#counter
        this.#parameters = this.toParameterObjects(continuing.func, continuing.params)
      }
      else{
        this.#functions[name].ended = true
      }
    }
  }
  #isl_execute(func, ...inParameters){
    ISLInterpreter.validateStr("execute", ["name", func])
    if(!this.#doesFuncExist(func)){
      throw new ISLError("Function '"+func+"' does not exist!", ReferenceError)
    }
    else{
      let parameters = inParameters.slice(0)
      if(inParameters.length === 0){parameters = [];}
      this.#callstack.push({calledFrom: this.#counter, func: func, params: parameters})
      if(this.#debug){
        console.log("Function:",func,"| parameter names:",parameters)
      }
      this.#parameters = this.toParameterObjects(func, parameters)
      if(this.#debug){
        console.log("parameter state",this.#parameters)
      }
      this.#counter = this.#getFunction(func).indexStart
    }
  }
  //Variable Manipulation: Binary operators
  #isl_add(variable, value){
    ISLInterpreter.validateStr("add", ["variable", variable])
    if(this.#doesVarExist(variable)){
      if(value){
        const varToModify = this.#getVarObj(variable)
        if(this.#staticTypes && (varToModify.type !== "number" && varToModify.type !== "string")){
          throw new ISLError("Cannot add to a variable with type '"+varToModify.type+"'", TypeError)
        }
        varToModify.value += value
        varToModify.type = "number"
      }
    }
    else{
      throw new ISLError("Variable '"+variable+"' does not exist!", ReferenceError)
    }
  }
  #isl_sub(variable, value){
    ISLInterpreter.validateStr("subtract", ["variable", variable])
    ISLInterpreter.validateNum("subtract", ["value", value])
    if(this.#doesVarExist(variable)){
      const varToModify = this.#getVarObj(variable)
      if(this.#staticTypes && varToModify.type !== "number"){
        throw new ISLError("Cannot subtract from a variable with type '"+varToModify.type+"'", TypeError)
      }
      varToModify.value -= value
      varToModify.type = "number"
    }
    else{
      throw new ISLError("Variable '"+variable+"' does not exist!", ReferenceError)
    }
  }
  #isl_mult(variable, value){
    ISLInterpreter.validateStr("multiply", ["variable", variable])
    ISLInterpreter.validateNum("multiply", ["value", value])
    if(this.#doesVarExist(variable)){
      const varToModify = this.#getVarObj(variable)
      if(this.#staticTypes && varToModify.type !== "number"){
        throw new ISLError("Cannot multiply a variable with type '"+varToModify.type+"'", TypeError)
      }
      varToModify.value *= value
      varToModify.type = "number"
    }
    else{
      throw new ISLError("Variable '"+variable+"' does not exist!", ReferenceError)
    }
  }
  #isl_exp(variable, value){
    ISLInterpreter.validateStr("exponent", ["variable", variable])
    ISLInterpreter.validateNum("exponent", ["value", value])
    if(this.#doesVarExist(variable)){
      const varToModify = this.#getVarObj(variable)
      if(this.#staticTypes && varToModify.type !== "number"){
        throw new ISLError("Cannot exponentiate a variable with type '"+varToModify.type+"'", TypeError)
      }
      varToModify.value **= value
      varToModify.type = "number"
    }
    else{
      throw new ISLError("Variable '"+variable+"' does not exist!", ReferenceError)
    }
  }
  #isl_root(variable, value){
    ISLInterpreter.validateStr("root", ["variable", variable])
    ISLInterpreter.validateNum("root", ["value", value])
    if(this.#doesVarExist(variable)){
      const varToModify = this.#getVarObj(variable)
      if(this.#staticTypes && varToModify.type !== "number"){
        throw new ISLError("Cannot calculate nth root of a variable with type '"+varToModify.type+"'", TypeError)
      }
      varToModify.value **= 1/value
      varToModify.type = "number"
    }
    else{
      throw new ISLError("Variable '"+variable+"' does not exist!", ReferenceError)
    }
  }
  #isl_div(variable, value){ //Now with static typing!
    ISLInterpreter.validateStr("divide", ["variable", variable])
    ISLInterpreter.validateNum("divide", ["value", value])
    if(this.#doesVarExist(variable)){
      const varToModify = this.#getVarObj(variable)
      if(this.#staticTypes && varToModify.type !== "number"){
        throw new ISLError("Cannot divide a variable with type '"+varToModify.type+"'", TypeError)
      }
      varToModify.value /= value
      varToModify.type = "number"
    }
    else{
      throw new ISLError("Variable '"+variable+"' does not exist!",ReferenceError)
    }
  }
  #isl_set(variable, value){
    ISLInterpreter.validateStr("set", ["variable", variable])
    if(this.#doesVarExist(variable)){
      const varToModify = this.#getVarObj(variable)
      if(varToModify.type === undefined){
        varToModify.type = typeof value
      }
      if(this.#staticTypes && varToModify.type !== typeof value){
        throw new ISLError("Cannot set a variable with type '"+varToModify.type+"' to a '"+typeof value+"'", TypeError)
      }
      varToModify.value = value
    }
    else{
      throw new ISLError("Variable '"+variable+"' does not exist!", ReferenceError)
    }
  }
  //Variable Manipulation: Unary operators
  #isl_round(variable){
    ISLInterpreter.validateStr("round", ["variable", variable])
    if(this.#doesVarExist(variable)){
      let v = this.#getVarObj(variable)
      const varToModify = this.#getVarObj(variable)
      if(this.#staticTypes && varToModify.type != "number"){
        throw new ISLError("Cannot round a variable with type '"+varToModify.type+"'", TypeError)
      }
      else{
        varToModify.type = "number"
      }
      varToModify.value = Math.round(v.value)
    }
    else{
      throw new ISLError("Variable '"+variable+"' does not exist!", ReferenceError)
    }
  }
  #isl_negate(variable){
    ISLInterpreter.validateStr("negate", ["variable", variable])
    if(this.#doesVarExist(variable)){
      const varToModify = this.#getVarObj(variable)
      if(this.#staticTypes && varToModify.type != "number"){
        throw new ISLError("Cannot negate a variable with type '"+varToModify.type+"'", TypeError)
      }
      else{
        varToModify.type = "number"
      }
      varToModify.value = -varToModify.value
    }
    else{
      throw new ISLError("Variable '"+variable+"' does not exist!", ReferenceError)
    }
  }
  //IO
  #isl_log(value){
    this.#console.push(value)
  }
  #isl_popup_input(variable, value){
    ISLInterpreter.validateStr("popup-input", ["variable", variable])
    if(this.#doesVarExist(variable)){
      let v = this.#getVarObj(variable)
      const newValue = ISLInterpreter.#tryToNum(prompt(value))
      this.#isl_set(variable, newValue)
    }
    else{
      throw new ISLError("Variable '"+variable+"' does not exist!", ReferenceError)
    }
  }
  #isl_awaitkey(variable, type = "set"){
    ISLInterpreter.validateStr("awaitkey", ["variable",variable], ["type", type])
    if(this.#doesVarExist(variable)){
      this.#listeningForKeyPress = true
      if(this.#debug){
        this.#log("Awaiting key press...")
      }
      this.#listenerTarget = variable
      this.#listenerManipulationType = type
    }
    else{
      throw new ISLError("Variable '"+variable+"' does not exist!", ReferenceError)
    }
  }
  #isl_getkeys(variable, type = "set"){
    ISLInterpreter.validateStr("getkeys", ["variable",variable], ["type", type])
    if(this.#doesVarExist(variable)){
      let keys = Object.getOwnPropertyNames(this.#pressed)
      let output = ""
      if(this.#currentLabels.includes("grouped")){
        output = "["+keys.join("|")+"]"
      }
      else{
        output = keys.join(",")
      }
      const varToModify = this.#getVarObj(variable)
      if(this.#staticTypes && varToModify.type != "string"){
        throw new ISLError("Variable with type '"+varToModify.type+"' cannot be set to value with type 'string'", TypeError)
      }
      else{
        varToModify.type = "string"
      }

      if(type === "add"){
        varToModify.value += output
      }
      else if(type === "set"){
        varToModify.value = output
      }
      else{
        throw new ISLError("Type "+type+" for 'getkeys' not recognised, should be 'add' or 'set'", SyntaxError)
      }
    }
    else{
      throw new ISLError("Variable '"+variable+"' does not exist!", ReferenceError)
    }
  }
  //Flow Control
  #isl_if(val1, operator, val2, code){
    ISLInterpreter.validateStr("if", ["operator",operator])
    if(this.#operate(val1, operator, val2)){
      if(this.#debug) console.log("condition met, executing {"+code.join(" ")+"}")
      this.#executeStatement(code)
    }
    else{
      if(this.#debug) console.log("condition not met")
    }
  }
  //Program Interface
  #isl_export(local, external){
    if(this.allowExport){
      ISLInterpreter.validateStr("export", ["external",external], ["local",local])
      if(this.#doesVarExist(local)){
        this.#setVariableFromFullPath(external, this.getVar(local))
      }
      else{
        throw new ISLError("Variable '"+local+"' does not exist!", ReferenceError)
      }
    }
    else{
      this.#handleDisallowedOperation("Export to "+external+".")
    }
  }
  #isl_import(external, local){
    if(this.allowImport){
      ISLInterpreter.validateStr("import", ["external",external], ["local",local])
      if(this.#doesVarExist(local)){
        const newValue = this.#getVariableFromFullPath(external)
        this.#isl_set(local, newValue)
      }
      else{
        throw new ISLError("Variable '"+local+"' does not exist!", ReferenceError)
      }
    }
    else{
      this.#handleDisallowedOperation("Import of "+external+".")
    }
  }
  
  /** Validator for number inputs.
   * @param {string} keyword The name of the keyword
   * @param {...[string, *]} inputs List of inputs, in the form [name, value]
  */
  static validateNum(keyword, ...inputs){
    ISLInterpreter.#validate(keyword, "number", ...inputs)
  }
  /** Validator for string inputs.
   * @param {string} keyword The name of the keyword
   * @param {...[string, *]} inputs List of inputs, in the form [name, value]
  */
  static validateStr(keyword, ...inputs){
    ISLInterpreter.#validate(keyword, "string", ...inputs)
  }
  /** Validator for any inputs.
   * @param {string} keyword The name of the keyword
   * @param {string} type The enforced type.
   * @param {...[string, *, (string|undefined)]} inputs List of inputs, in the form [name, value]. A third element can be added, which affects that input. "optional" makes type "undefined" acceptable.
  */
  static #validate(keyword, type, ...inputs){
    for(let i of inputs){
      if(i[2] === "optional"){
        if(typeof i[1] !== type && typeof i[1] !== "undefined"){
          throw new ISLError("'"+keyword+"' expects type '"+type+"' or empty for argument '"+i[0]+"', got '"+typeof i[1]+"' ('"+i[1]+"')", TypeError)
        }
      }
      else if(typeof i[1] !== type){
        throw new ISLError("'"+keyword+"' expects type '"+type+"' for argument '"+i[0]+"', got '"+typeof i[1]+"' ('"+i[1]+"')", TypeError)
      }
    }
  }

  //come on, move them already
  //DON'T MAKE MORE

  
  defineISLKeyword(...inputs){
    this.#warn("Keyword '"+inputs[0]+"' not imported: Use of defineISLKeyword is no longer supported, use extensions instead.")
  }

  /**
   * Loads content from an extension.
   * @param {ISLExtension} extension Extension to load from.
   */
  extend(extension){
    if(extension.id){
      this.#extensions.push(extension)
    }
    else{
      throw new ISLError("Attempt to import extension without an identifier", EnvironmentError)
    }
    for(let wordName in extension.keywords){
      let keyword = extension.keywords[wordName]
      this.#customKeywords[wordName] = {callback: keyword.callback, source: extension}
    }
    for(let varName in extension.variables){
      let variable = extension.variables[varName]
      this.#globalVariables[varName] = {value: variable.value, type: typeof variable.value}
    }
    //this.#customLabels.push(...extension.labels)
  }
  /**
   * Loads an extension from a class.
   * @param {*} extensionClass Class of the extension.
   * @param  {...any} constructorParams Parameters to pass into the constructor, after the interpreter.
   * @see {@link }
   */
  classExtend(extensionClass, ...constructorParams){
    const extension = new extensionClass(this, ...constructorParams)
    this.extend(extension)
  }
  #hasExtensionWithId(id){
    for(let ext of this.#extensions){
      if(ext.id === id){
        return true
      }
    }
    return false
  }
  //OK fine static stuff
  static #isLabel(name){
    for(let i of ISLInterpreter.#labels){
      if(i.label === name){
        return true
      }
    }
    return false
  }
  #isOwnLabel(name){
    for(let i of this.#customLabels){
      if(i.label === name){
        return true
      }
    }
    return false
  }
  static #isLabelFor(name, keyword){
    for(let i of ISLInterpreter.#labels){
      if(i.label === name){
        if(i.for.includes(keyword)){
          return true
        }
      }
    }
    return false
  }
  #isOwnLabelFor(name, keyword){
    for(let i of this.#customLabels){
      if(i.label === name){
        if(i.for.includes(keyword)){
          return true
        }
      }
    }
    return false
  }
}



function clamp(number, min, max) {
  return Math.min(Math.max(number, min), max);
}

class EnvironmentError extends Error{}

/**
 * ISL Error type, use this if you want your error to show up as an error in the ISL code instead of an internal one.
 */
class ISLError extends Error{
  /**
   * @param {string} message Error message. A short description (one sentence) of what went wrong.
   * @param {class} type Extra type of an error. Should be a subclass of `Error`.
   */
  constructor(message, type){
    super(message)
    this.type = type
  }
}

export { ISLInterpreter, ISLError }
