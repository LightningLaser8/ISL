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
  //Basically, this describes types and when they are valid
  #literals = {
    comparator: value => ["=", "!=", "<", ">", "in"].includes(value),
    keyword: value => value in this.#defaultKeywords || value in this.#customKeywords,
  }

  static #deprecated = {
    webprompt: {replacements: ["'popup-input'"], type: "renamed", display: "'webprompt'"},
    declare: {replacements: ["'string'", "'function'", "'number'"], type: "split", display: "'declare var/cmd'"},
    flush: {replacements: ["'log'"], type: "merged", display: "'flush'"}
  }
  #warnedFor = []

  environment = "js"

  //ISL meta
  #meta = {}
  #ignored = [] //reset this when file changes?

  //Execution
  #isl = []
  #filename = "<direct execution>"
  #realFilename = ""
  #loaded = false
  #counter = 0
  #lastErrorLine = 0
  #stopped = false
  #executor = null

  //Vars
  #localVariables = {}
  #globalVariables = {
    //Mouse variables
    mleft: {value: false, type: "boolean"},
    mright: {value: false, type: "boolean"},
    mwheel: {value: false, type: "boolean"},
    m4: {value: false, type: "boolean"},
    m5: {value: false, type: "boolean"},
    many: {value: false, type: "boolean"}
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
    {label: "separated", for: ["flush"]},
    {label: "grouped", for: ["getkeys"]},
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
    this.#globalVariables.mleft.value = this.#isMouseButtonPressed("left")
    this.#globalVariables.mright.value = this.#isMouseButtonPressed("right")
    this.#globalVariables.mwheel.value = this.#isMouseButtonPressed("wheel")
    this.#globalVariables.m4.value = this.#isMouseButtonPressed("back")
    this.#globalVariables.m5.value = this.#isMouseButtonPressed("forward")

    this.#globalVariables.many.value = (event.buttons > 0)
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
    this.#warnOnce("deprecated."+type+"."+feature, "Deprecated feature used: "+featObj.display+" ("+type+", line "+this.#pc+")"+"\nFeature has been "+featObj.type+".\n"+(featObj.replacements?(featObj.replacements.length > 1?("Use "+featObj.replacements.slice(0, -1).join(", ")+" or "+featObj.replacements.at(-1)+" instead."):"Use "+featObj.replacements[0]+" instead."):"Do not use."))
    return true;
  }

  #warnOnce(warnID, ...msg){
    if(this.#warnedFor.includes("."+warnID+"|"+this.#pc)) return;
    this.#warn(...msg)
    this.#warnedFor.push("."+warnID+"|"+this.#pc)
    if(this.#debug){
      this.#log("warning ID|line: "+this.#warnedFor)
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
    this.#log(this.#console.join(""))
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
          this.#log("Executing line "+this.#counter)
        }
        if(this.#isl[this.#counter] || this.#isl[this.#counter] == ""){
          this.#executeLineInternal(this.#isl[this.#counter])
          this.#counter ++
          if(this.#pc > this.#isl.length){
            this.#fullReset()
            if(this.#debug){
              this.#log("End of program reached.")
            }
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
            this.#log("Executing line "+this.#counter)
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
              if(!this.#stopped) this.#executeISL()
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
    this.#reset()
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
    this.#hardReset()
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
      this.#log("Code:",line)
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
      let noComment = ISLInterpreter.#removeISLComment(line).trim()
      if(noComment != null && noComment != undefined && noComment != "" && noComment != "\n"){
        if(noComment.match(/^\[.*\]$/)){
          this.#parseMeta(noComment)
          break exe
        }
        this.#parseLine(noComment)
      }
    }
  }
  /**
   * Parses a line of ISL code into an array of ISL parts.
   * @param {string} line Line of ISL code.
   */
  #parseLine(line){
    let inQuotes = false,
      inSquareBrackets = false,
      inBackslashes = false
    let currentComponent = ""
    let components = []
    let currentType = "identifier"
    if(this.#debug) this.#log("Parsing line '"+line+"'")
    let removeComponent = () => {
      let removed = components.pop()
      if(this.#debug){
        this.#log("Removed component '"+removed.value+"' (type '"+removed.type+"')")
      }
    }
    let addComponent = (content = "", type = currentType, setType = false) => {
      if(!isComponent(currentComponent)) return; //Remove bad components
      if(this.#debug){
        this.#log("Component: '"+content+"' type '"+type+"'")
      }
      let obj = {value: content, type: type}
      if(!setType){
        obj = ISLInterpreter.#restoreOriginalType(obj)
        if(obj.type === "identifier"){
          for(let type in this.#literals){
            let func = this.#literals[type]
            if(func(obj.value)){
              obj.type = type
            }
          }
        }
      }
      if(this.#debug){
        if(obj) this.#log("Converted: '"+obj.value+"' type '"+obj.type+"'") 
          else this.#log("No object!")
      }
      if(obj.value !== null){
        components.push(obj)
        if(this.#debug) this.#log("Added to parts")
      }
      else{
        if(this.#debug) this.#log("Skipped, value was null")
      }
      currentType = "identifier" //Reset type
      currentComponent = ""
    }
    let isComponent = component => {
      return component.length > 0 || currentType !== "identifier"
    }
    for(let index = 0; index < line.length; index++){
      let character = line[index]
      //SPACES
      //Generic space
      if(character === " " && !inQuotes && !inSquareBrackets){
        addComponent(currentComponent)
        continue //Ignore the space
      }
      if(!this.#skipping){
        //QUOTES  
        //Opening quote
        if(character === "\"" && !inQuotes){
          inQuotes = true
          addComponent(currentComponent) //Push everything before as a component
          currentType = "string" //It's a string!
          continue //Ignore the quote
        }
        //Closing quote
        if(character === "\"" && inQuotes){
          if(currentType !== "string") throw new ISLError("Unexpected closing '\"'", SyntaxError)
          inQuotes = false
          addComponent(currentComponent) //Push everything as a component
          continue //Ignore the quote
        }

        //VAR REFS
        //Opening backslash
        if(character === "\\" && !inQuotes && !inSquareBrackets && !inBackslashes){
          inBackslashes = true
          addComponent(currentComponent) //Push everything before as a component
          currentType = "variable"
          if(line[index - 1] === "-"){
            currentType = "local-variable"
            removeComponent()
          }
          if(line[index - 1] === ":"){
            currentType = "parameter"
            removeComponent()
          }
          if(line[index + 1] === "_") currentType = "global-variable"
          if(this.#debug) this.#log("Variable getter with type: '"+currentType+"'")
          continue //Ignore the slash
        }
        //Closing backslash
        if(character === "\\" && !inQuotes && !inSquareBrackets && inBackslashes){
          inBackslashes = false
          if(currentType !== "variable" && currentType !== "local-variable" && currentType !== "parameter" && currentType !== "global-variable") throw new ISLError("Unexpected closing '\\'", SyntaxError)
          if(this.#debug) this.#log("Variable getter with type: '"+currentType+"' ended")
          let obj = null
          //Figure out what this is
          if(currentType === "global-variable"){
            obj = this.#getGlobalVarObj(currentComponent.substring(1))
          }
          else if(currentType === "parameter"){
            obj = this.#getParameterObj(currentComponent)
          }
          else if(this.#callstack.length > 0 && currentType !== "local-variable"){
            try{obj =  this.#getParameterObj(currentComponent)}
            catch(e){
              obj = this.#getVarObj(currentComponent)
            }
          }
          else{
            obj = this.#getVarObj(currentComponent)
          }
          addComponent(obj.value, obj.type, true) //Push the variable content as a component
          currentComponent = "" //Clear component
          continue //You get it by now
        }

        //BRACKETS
        //Opening bracket
        if(character === "[" && !inQuotes && !inSquareBrackets){
          inSquareBrackets = true
          addComponent(currentComponent) //Push everything before as a component
          currentType = "group" //It's a group!
          continue //Ignore the bracket
        }
        //Closing bracket
        if(character === "]" && !inQuotes && inSquareBrackets){
          if(!inSquareBrackets || currentType !== "group") throw new ISLError("Unexpected closing ']'", SyntaxError)
          inSquareBrackets = false
          addComponent(ISLGroup.from(currentComponent).map(x => ISLInterpreter.#restoreOriginalType({value: x, type:"identifier"})), "group", true) //Push everything as a component
          continue //Ignore the bracket
        }
      }
      


      //If nothing else happened
      currentComponent += character
    }
    addComponent(currentComponent) //End it
    //Final validation
    if(inQuotes) throw new ISLError("Unterminated string literal", SyntaxError);
    if(inSquareBrackets) throw new ISLError("Unterminated bracket group", SyntaxError);
    if(inBackslashes) throw new ISLError("Unterminated variable getter", SyntaxError);
    this.#executeStatement(components)
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
  #getParameter(varName){
    if(this.#parameters[varName] != null){
      return this.#parameters[varName].value
    }
    throw new ISLError("Parameter '"+varName+"' does not exist!", ReferenceError)
  }
  /**
   * Gets parameter value from declared name. Throws an error if it doesn't exist.
   * @param {String} varName Parameter name to search for.
   * @returns {{value: *, type: string}} The value of the object corresponding to the name
   */
  #getParameterObj(varName){
    if(this.#parameters[varName] != null){
      return this.#parameters[varName]
    }
    throw new ISLError("Parameter '"+varName+"' does not exist!", ReferenceError)
  }
  /**
   * 
   * @param {string} func 
   * @param {{type: string, value: *}[]} parameters 
   * @returns 
   */
  #toParameterObjects(func, parameters){
    if(this.#debug){
      this.#log("Input: function: '"+func+"' parameters:",parameters)
    }
    if(func === "") return;
    let expectedParams = this.#getFunction(func).params
    if(this.#debug){
      this.#log("Expected: ",expectedParams)
    }
    //Convert array to read-only variable stuff
    let params = {}
    if(this.#debug){
      this.#log("parsing",parameters.length,"parameters")
    }
    if(parameters.length !== expectedParams.length){
      throw new ISLError("Function '"+func+"' requires "+expectedParams.length+" parameter(s), but received "+parameters.length, SyntaxError)
    }
    for(let p = 0; p < parameters.length; p++){
      let parameter = parameters[p]
      if(this.#debug){
        this.#log("parameter index "+p+" = ",parameter.value)
      }
      if(expectedParams[p].type !== parameter.type){
        throw new ISLError("Parameter '"+expectedParams[p].name+"' has type '"+expectedParams[p].type+"', but was given an argument of type '"+parameter.type+"'", TypeError)
      }
      Object.defineProperty(params, expectedParams[p].name, {
        value: {
          type: parameter.type,
          value: parameter.value
        }
      })
      if(this.#debug){
        this.#log("Parsed parameter",params[expectedParams[p].name])
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
   * @returns {{value: *, type: string}} The variable object corresponding to the name
   */
  #getVarObj(varName){
    if(this.#localVariables[varName] != null){
      return this.#localVariables[varName]
    }
    throw new ISLError("Variable '"+varName+"' does not exist!", ReferenceError)
  }
  /**
   * Gets global variable object from declared name. Throws an error if it doesn't exist.
   * @param {String} varName Variable to search for, without the underscore.
   * @returns {{value: *, type: string}} The variable object corresponding to the name
   */
  #getGlobalVarObj(varName){ //
    if(this.#globalVariables[varName] != null){
      return this.#globalVariables[varName]
    }
    throw new ISLError("Global variable '"+varName+"' does not exist!", ReferenceError)
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
    this.#callstack = []
    this.#parameters = {}
    this.#console.splice(0)
  }
  /**
   * Completely resets everything, except for internal storage.
   */
  #fullReset(){
    this.#stopExecutionDestructive()
    this.#counter = 0
    this.#lastErrorLine = 0
    this.#stopped = true
    this.#executor = null
    this.#listeningForKeyPress = false
    this.#waits = 0
    //Reset meta
    this.#ignored = []
    if(this.#debug){
      this.#log("Interpreter reset.")
    }
  }
  /**
   * Stops everything, and clears stored ISL.
   */
  clear(){
    this.#fullReset()
    this.#filename = "<direct execution>"
    this.#isl.splice(0)
    this.#realFilename = ""
    this.#loaded = false
  }
  /**
   * Tries to get the input as anything other than a string.
   * @param {{value: *, type: string}} thing 
   * @returns {{value: number | boolean | string | *, type: "number" | "boolean" | "string" | string}} The input casted to something else, if applicable.
   */
  static #restoreOriginalType(thing){
    //Builtins
    if(!thing) return { value: null, type: "undefined" }
    if(thing.value == null && thing.type !== "identifier") return { value: null, type: "undefined" }
    if(thing.type !== "identifier") return thing
    if(thing.value === "true") return { value: true, type: "boolean" } //'True' value
    if(thing.value === "false") return { value: false, type: "boolean" } //'False' value
    if(/^-?[0-9]+(?:\.[0-9]+)?$/.test(thing.value)) return { value: parseFloat(thing.value), type: "number" }
    if(thing.type === "group") return { value: ISLGroup.from(thing.value), type: "group" }
    if(thing.value.match(/^~-?[0-9]+(?:\.[0-9]+)?$/)) return { value: thing.value, type: "relpos" }
    return thing
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
  #compare(val1, operator, val2){
    if(this.#debug){
      this.#log(val1 + " " + operator + " " + val2)
    }
    switch(operator){
      case "=":
        return val1 === val2
      case "<":
        return val1 < val2
      case ">":
        return val1 > val2
      case "!=":
        return val1 !== val2
      case "in":
        if(val2 instanceof ISLGroup){
          if(this.#debug){
            this.#log("Value 2 is a group")
            this.#log(val2,"contains",val1)
          }
          return val2.includes(val1)
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
    let val = (typeof ISLInterpreter.#restoreOriginalType(xedVal) !== "string")?xedVal:"\""+xedVal+"\""
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
   * @param {Array<{value: *, type: string}>} statementArray 
   */
  #executeStatement(statementArray){
    let parts = statementArray
    let keyword = parts[0].value

    if(this.#debug){
      this.#log("Part objects:",parts)
      this.#log("Part values: '"+parts.map(x => x.value).join("', '")+"'")
      this.#log("Existing variables:",this.#localVariables)
      this.#log("Existing functions:",this.#functions)
      this.#log("Keyword or label being inspected:",keyword)
    }
    if(this.#ignored.includes(keyword)){
      if(this.#debug){
        this.#log(keyword, "was ignored")
      }
      return;
    }
    while(ISLInterpreter.#isLabel(keyword) || this.#isOwnLabel(keyword) && parts[1] !== undefined){
      this.#currentLabels.push(keyword)
      if(this.#debug){
        this.#log(keyword, "is label")
      }
      parts = parts.slice(1)
      keyword = parts[0].value
    }
    for(let l of this.#currentLabels){
      if(!(ISLInterpreter.#isLabelFor(l, keyword) || this.#isOwnLabelFor(l, keyword))){
        throw new ISLError("Label '"+l+"' is not applicable to '"+keyword+"', only to: "+this.#getKeywordsFor(keyword), SyntaxError)
      }
    }
    if(this.#skipping){
      if(this.#debug){
        this.#log("*skipped due to function declaration")
      }
      if(keyword === "end"){
        this.#defaultKeywords.end.callback(this.#currentLabels, parts[1])
        this.#skipping = false
      }
    }
    else{
      if(this.#handleDeprecatedFeature(keyword, "keyword")) return;

      //Regular keywords
      if(this.#defaultKeywords[keyword] !== undefined){
        const dkeyword = this.#defaultKeywords[keyword]
        const inputs = parts.slice(1)
        let fallbackDescriptor = null
        if(dkeyword.descriptors){
          let len = dkeyword.descriptors.length
          for(let index = 0; index < len; index++){
            let descriptor = dkeyword.descriptors[index] ?? fallbackDescriptor
            if(dkeyword.descriptors[index]?.recurring){
              if(this.#debug) this.#log("Recurring descriptor (will accept all inputs after):")
              if(parts[index]){
                len = parts.length - 1
                fallbackDescriptor = descriptor
              }
            }
            if(descriptor) this.#validateDescriptor(keyword, parts[index + 1], descriptor)
          }
        }
        if(this.#debug) {
          this.#log("Validation passed")
          this.#log("Executing keyword '"+keyword+"' with inputs", ...inputs)
        }
        dkeyword.callback.apply(this, [this.#currentLabels, ...inputs])
      }
      //Custom keywords
      else if(this.#customKeywords[keyword] !== undefined){
        const ckeyword = this.#customKeywords[keyword]
        const inputs = parts.slice(1)
        let fallbackDescriptor = null
        if(ckeyword.descriptors){
          let len = ckeyword.descriptors.length
          for(let index = 0; index < len; index++){
            let descriptor = ckeyword.descriptors[index] ?? fallbackDescriptor
            if(ckeyword.descriptors[index]?.recurring){
              if(this.#debug) this.#log("Recurring descriptor (will accept all inputs after):")
              if(parts[index]){
                len = parts.length - 1
                fallbackDescriptor = descriptor
              }
            }
            if(descriptor) this.#validateDescriptor(keyword, parts[index + 1], descriptor)
          }
        }
        if(this.#debug) {
          this.#log("Custom validation passed")
          this.#log("Executing (custom) keyword '"+keyword+"' with inputs", ...inputs)
        }
        ckeyword.callback.apply(ckeyword.source, [this, this.#currentLabels, ...inputs])
      }

      //Error if invalid
      else{
        throw new ISLError("Keyword or label '"+parts[0].value+"' not recognised", SyntaxError)
      }

      //Clear labels
      this.#currentLabels.splice(0)
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
    if(line.type === "relpos"){
      this.#pc = this.#pc + parseInt(line.value.substring(1)) - 1
    }
    else {
      this.#pc = parseInt(line.value) - 1
    }
  }
  //Variable Creation
  #isl_declare(declareType, name, initialValue = null, type, functionParameters = []){
    if(declareType === "var"){
      if(type === undefined){
        this.#warnOnce("var.notype","No type set for variable '"+name+"' (declared line "+this.#pc+")")
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
        let params = []
        for(let param of functionParameters.map(x => x.value)){
          let opts = param.split(":")
          params.push({
            name: opts[0],
            type: opts[1]
          })
        }
        if(this.#debug){
          this.#log("function declared with parameters",functionParameters,"=>",params)
        }
        this.#functions[name] = {indexStart: this.#counter, declared: true, ended: false, params: params}
        if(this.#debug){
          this.#log("function object is now",this.#functions[name])
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
    if(!this.#doesVarExist(name)){
      throw new ISLError("Cannot delete nonexistent variable '"+name+"'", ReferenceError)
    }
    else{
      delete this.#localVariables[name]
    }
  }
  //Functions
  #isl_end(name){
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
        this.#parameters = this.#toParameterObjects(continuing.func, continuing.params)
        if(this.#debug){
          this.#log("Moved up; Callstack is now", this.#callstack)
        }
      }
      else{
        this.#functions[name].ended = true
        if(this.#debug){
          this.#log("Function declaration ended")
        }
      }
    }
  }
  #isl_execute(func, ...inParameters){
    if(!this.#doesFuncExist(func)){
      throw new ISLError("Function '"+func+"' does not exist!", ReferenceError)
    }
    else{
      let parameters = inParameters.slice(0)
      if(inParameters.length === 0){parameters = [];}
      this.#callstack.push({calledFrom: this.#counter, func: func, params: parameters})
      if(this.#debug){
        this.#log("Function call; Callstack is now", this.#callstack)
      }
      if(this.#debug){
        this.#log("Function:",func,"| parameter names:",parameters)
      }
      this.#parameters = this.#toParameterObjects(func, parameters)
      if(this.#debug){
        this.#log("parameter state",this.#parameters)
      }
      this.#counter = this.#getFunction(func).indexStart
    }
  }
  //Variable Manipulation: Binary operators
  #isl_add(variable, value){
    if(this.#doesVarExist(variable)){
      const varToModify = this.#getVarObj(variable)
      if((varToModify.type !== "number" && varToModify.type !== "string")){
        throw new ISLError("Cannot add to a variable with type '"+varToModify.type+"'", TypeError)
      }
      varToModify.value += value.value
    }
    else{
      throw new ISLError("Variable '"+variable+"' does not exist!", ReferenceError)
    }
  }
  #isl_sub(variable, value){
    if(this.#doesVarExist(variable)){
      const varToModify = this.#getVarObj(variable)
      if(varToModify.type !== "number"){
        throw new ISLError("Cannot subtract from a variable with type '"+varToModify.type+"'", TypeError)
      }
      varToModify.value -= value.value
      varToModify.type = "number"
    }
    else{
      throw new ISLError("Variable '"+variable+"' does not exist!", ReferenceError)
    }
  }
  #isl_mult(variable, value){
    if(this.#doesVarExist(variable)){
      const varToModify = this.#getVarObj(variable)
      if(varToModify.type !== "number"){
        throw new ISLError("Cannot multiply a variable with type '"+varToModify.type+"'", TypeError)
      }
      varToModify.value *= value.value
      varToModify.type = "number"
    }
    else{
      throw new ISLError("Variable '"+variable+"' does not exist!", ReferenceError)
    }
  }
  #isl_exp(variable, value){
    if(this.#doesVarExist(variable)){
      const varToModify = this.#getVarObj(variable)
      if(varToModify.type !== "number"){
        throw new ISLError("Cannot exponentiate a variable with type '"+varToModify.type+"'", TypeError)
      }
      varToModify.value **= value.value
      varToModify.type = "number"
    }
    else{
      throw new ISLError("Variable '"+variable+"' does not exist!", ReferenceError)
    }
  }
  #isl_root(variable, value){
    if(this.#doesVarExist(variable)){
      const varToModify = this.#getVarObj(variable)
      if(varToModify.type !== "number"){
        throw new ISLError("Cannot calculate nth root of a variable with type '"+varToModify.type+"'", TypeError)
      }
      varToModify.value **= 1/value.value
      varToModify.type = "number"
    }
    else{
      throw new ISLError("Variable '"+variable+"' does not exist!", ReferenceError)
    }
  }
  #isl_div(variable, value){ //Now with static typing!
    if(this.#doesVarExist(variable)){
      const varToModify = this.#getVarObj(variable)
      if(varToModify.type !== "number"){
        throw new ISLError("Cannot divide a variable with type '"+varToModify.type+"'", TypeError)
      }
      varToModify.value /= value.value
      varToModify.type = "number"
    }
    else{
      throw new ISLError("Variable '"+variable+"' does not exist!",ReferenceError)
    }
  }
  #isl_set(variable, value){
    if(this.#doesVarExist(variable)){
      const varToModify = this.#getVarObj(variable)
      if(varToModify.type === undefined){
        varToModify.type = value.type
      }
      if(varToModify.type !== value.type){
        throw new ISLError("Cannot set a variable with type '"+varToModify.type+"' to a value of type '"+value.type+"'", TypeError)
      }
      varToModify.value = value.value
    }
    else{
      throw new ISLError("Variable '"+variable+"' does not exist!", ReferenceError)
    }
  }
  //Variable Manipulation: Unary operators
  #isl_round(variable){
    if(this.#doesVarExist(variable)){
      let v = this.#getVarObj(variable)
      const varToModify = this.#getVarObj(variable)
      if(varToModify.type != "number"){
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
    if(this.#doesVarExist(variable)){
      const varToModify = this.#getVarObj(variable)
      if(varToModify.type != "number"){
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
  #isl_log(...value){
    this.#console.push(...value)
    this.#flush()
  }
  #isl_popup_input(variable, value){
    if(this.#doesVarExist(variable)){
      let v = this.#getVarObj(variable)
      const newValue = ISLInterpreter.#restoreOriginalType({type: "string", value: prompt(value)})
      this.#isl_set(variable, newValue)
    }
    else{
      throw new ISLError("Variable '"+variable+"' does not exist!", ReferenceError)
    }
  }
  #isl_awaitkey(variable, type = "set"){
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
      if(varToModify.type != "string"){
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
  #isl_if(val1, operator, val2, ...code){
    if(this.#compare(val1, operator, val2)){
      if(this.#debug) this.#log("condition met, executing '"+code.map(x => x.value).join(" ")+"'")
      this.#executeStatement(code)
    }
    else{
      if(this.#debug) this.#log("condition not met")
    }
  }
  //Program Interface
  #isl_export(local, external){
    if(this.allowExport){
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

  #validateDescriptor(keyword, input, descriptor){
    if(this.#debug) this.#log("Validating input on: '"+keyword+"', input:",input,"descriptor:",descriptor)
    const actualDescriptor = {
      type: "string",
      name: "<unnamed argument>",
      optional: false
    }
    let isCorrectType = (descriptor, input) => {
      return descriptor.type.split("|").includes(input?input.type:"undefined")
    }
    if(descriptor && !descriptor.type) {
      this.#warnOnce("desc.badtype","[line "+this.#pc+"] Input '"+actualDescriptor.name+"' has no type descriptor, defaulting to 'string'.")
    }
    Object.assign(actualDescriptor, descriptor)
    if(!actualDescriptor.optional && !input){
      throw new ISLError("'"+keyword+"' requires a value for input '"+actualDescriptor.name+"'", TypeError)
    }
    if(!isCorrectType(actualDescriptor, input) && actualDescriptor.type !== "any"){
      throw new ISLError("'"+keyword+"' expects type '"+actualDescriptor.type+"'"+(actualDescriptor.optional?" or nothing":"")+" for input '"+actualDescriptor.name+"', got '"+(input?input.type:"undefined")+"' (given '"+(input?input.value:"(nothing)")+"')", TypeError)
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
      this.#customKeywords[wordName] = {callback: keyword.callback, descriptors: keyword.descriptors, source: extension}
    }
    for(let varName in extension.variables){
      let variable = extension.variables[varName]
      this.#globalVariables[varName] = variable
    }
    if(!Array.isArray(extension.types)) return;
    for(let type of extension.types){
      this.#literals[type.name] = type.validator
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
  #getKeywordsFor(name){
    for(let i of ISLInterpreter.#labels){
      if(i.label === name){
        return i.for
      }
    }
    for(let i of this.#customLabels){
      if(i.label === name){
        return i.for
      }
    }
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
  #defaultKeywords = {
    var: {
      callback: (labels, ...inputs) => {this.#isl_declare("var", inputs[0].value)},
      descriptors: [
        {type: "identifier", name: "name"}
      ]
    },
    number: {
      callback: (labels, ...inputs) => {this.#isl_declare("var", inputs[0].value, 0, "number")},
      descriptors: [
        {type: "identifier", name: "name"}
      ]
    },
    string: {
      callback: (labels, ...inputs) => {this.#isl_declare("var", inputs[0].value, "", "string")},
      descriptors: [
        {type: "identifier", name: "name"}
      ]
    },
    function: {
      callback: (labels, ...inputs) => {this.#isl_declare("cmd", inputs[0].value, undefined, "function", inputs.slice(1))},
      descriptors: [
        {type: "identifier", name: "name"}
      ]
    },
    delete: {
      callback: (labels, ...inputs) => {this.#isl_delete(inputs[0].value)},
      descriptors: [
        {type: "identifier", name: "name"}
      ]
    },
    end: {
      callback: (labels, ...inputs) => {this.#isl_end(inputs[0].value)},
      descriptors: [
        {type: "identifier", name: "name"}
      ]
    },
    execute: {
      callback: (labels, ...inputs) => {this.#isl_execute(inputs[0].value, ...inputs.slice(1))},
      descriptors: [
        {type: "identifier", name: "name"}
      ]
    },
    set: {
      callback: (labels, ...inputs) => {this.#isl_set(inputs[0].value, inputs[1])},
      descriptors: [
        {type: "identifier", name: "name"},
        {type: "any", name: "value"}
      ]
    },
    add: {
      callback: (labels, ...inputs) => {this.#isl_add(inputs[0].value, inputs[1])},
      descriptors: [
        {type: "identifier", name: "name"},
        {type: "any", name: "value"}
      ]
    },
    subtract: {
      callback: (labels, ...inputs) => {this.#isl_sub(inputs[0].value, inputs[1])},
      descriptors: [
        {type: "identifier", name: "name"},
        {type: "number", name: "value"}
      ]
    },
    multiply: {
      callback: (labels, ...inputs) => {this.#isl_mult(inputs[0].value, inputs[1])},
      descriptors: [
        {type: "identifier", name: "name"},
        {type: "number", name: "value"}
      ]
    },
    divide: {
      callback: (labels, ...inputs) => {this.#isl_div(inputs[0].value, inputs[1])},
      descriptors: [
        {type: "identifier", name: "name"},
        {type: "number", name: "value"}
      ]
    },
    round: {
      callback: (labels, ...inputs) => {this.#isl_round(inputs[0].value)},
      descriptors: [
        {type: "identifier", name: "name"}
      ]
    },
    exponent: {
      callback: (labels, ...inputs) => {this.#isl_exp(inputs[0].value, inputs[1])},
      descriptors: [
        {type: "identifier", name: "name"},
        {type: "number", name: "power"}
      ]
    },
    root: {
      callback: (labels, ...inputs) => {this.#isl_root(inputs[0].value, inputs[1])},
      descriptors: [
        {type: "identifier", name: "name"},
        {type: "number", name: "root"}
      ]
    },
    negate: {
      callback: (labels, ...inputs) => {this.#isl_negate(inputs[0].value)},
      descriptors: [
        {type: "identifier", name: "name"}
      ]
    },
    log: {
      callback: (labels, ...inputs) => {this.#isl_log(...inputs.map(x => x.value))},
      descriptors: [
        {type: "any", name: "message", recurring: true}
      ]
    },
    flush: {
      callback: (labels, ...inputs) => {
        if(labels.includes("separated")){
          this.#flushSeparate()
        }
        else{
          this.#flush()
        }
      },
      descriptors: []
    },
    "popup-input": {
      callback: (labels, ...inputs) => {this.#isl_popup_input(inputs[0].value, inputs[1].value)},
      descriptors: [
        {type: "identifier", name: "target"},
        {type: "any", name: "message"}
      ]
    },
    awaitkey: {
      callback: (labels, ...inputs) => {this.#isl_awaitkey(inputs[0].value, inputs[1].value)},
      descriptors: [
        {type: "identifier", name: "target"},
        {type: "keyword", name: "manipulator"}
      ],
    },
    getkeys: {
      callback: (labels, ...inputs) => {this.#isl_getkeys(inputs[0].value, inputs[1].value)},
      descriptors: [
        {type: "identifier", name: "target"},
        {type: "keyword", name: "manipulator"}
      ],
    },
    restart: {
      callback: (labels, ...inputs) => {
        if(labels.includes("non-destructive")){
          this.stopExecution()
        }
        else{
          this.#stopExecutionDestructive()
        }
        this.startExecution(this.executeSpeed)
      },
      descriptors: [],
    },
    rundelay: {
      callback: (labels, ...inputs) => {
        this.executeSpeed = inputs[0].value
      },
      descriptors: [
        {type: "number", name: "speed"}
      ],
    },
    stop: {
      callback: (labels, ...inputs) => {
        if(this.#debug) this.#log("Program stopped by keyword.")
        this.#fullReset()
      },
      descriptors: [],
    },
    pause: {
      callback: (labels, ...inputs) => {
        this.#waits += inputs[0].value
      },
      descriptors: [
        {type: "number", name: "delay"}
      ],
    },
    if: {
      callback: (labels, ...inputs) => {
        this.#isl_if(inputs[0].value, inputs[1].value, inputs[2].value, ...inputs.slice(3))
      },
      descriptors: [
        {type: "any", name: "value 1"},
        {type: "comparator", name: "comparator"},
        {type: "any", name: "value 2"},
        {type: "any", name: "code", recurring: true}
      ],
    },
    jump: {
      callback: (labels, ...inputs) => {
        this.#goToLine(inputs[0])
      },
      descriptors: [
        {type: "number|relpos", name: "line"}
      ],
    },
    export: {
      callback: (labels, ...inputs) => {
        this.#isl_export(inputs[0].value, inputs[1].value)
      },
      descriptors: [
        {type: "identifier", name: "local"},
        {type: "string", name: "external"}
      ],
    },
    import: {
      callback: (labels, ...inputs) => {
        this.#isl_import(inputs[0].value, inputs[1].value)
      },
      descriptors: [
        {type: "string", name: "external"},
        {type: "identifier", name: "local"}
      ],
    },
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

class ISLGroup extends Array{
  /**
   * Creates a group from a string of the form `a|b|c`
   * @param {string} string A `|`-separated list of values, as a string.
   * @returns {ISLGroup} The group containing those values.
   */
  static from(string){
    let grp = new this()
    let arr = string.split("|")
    for(let i = 0; i < arr.length; i ++){
      grp[i] = arr[i]
    }
    return grp
  }
  includes(searchElement, fromIndex = 0){
    return Array.from(this.map(x => x?x.value:undefined)).includes(searchElement, fromIndex)
  }
  toString(){
    return "["+this.map(x => x.value).join("|")+"]"
  }
}

export { ISLInterpreter, ISLError }
