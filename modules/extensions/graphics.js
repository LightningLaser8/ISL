import { ISLExtension } from "../../core/extensions.js";
import { ISLInterpreter, ISLError } from "../../core/interpreter.js";
/** Extension replacing built-in graphics functionality, as this would differ cross-platform. */
class GraphicsExtension extends ISLExtension {

  #canvas = null
  #bufferedGraphics = true
  #canvasSettings = {
    outlineWidth: 1,
    outlineColour: "#000000",
    fillColour: "#cacaca",
    textSize: 20,
    textFont: "Arial"
  }
  #drawBuffer = []
  #currentLabels = []
  /**
     * @param {ISLInterpreter} interpreter Interpreter this is loaded on. This is auto-set on `classExtend()`, use that instead.
     * @param {Object} options Options for running.
     */
  constructor(interpreter, options){
    super("graphics")
    this.interpreter = interpreter
    this.#bufferedGraphics = options?.bufferedGraphics ?? true

    addEventListener("mouseup", () => {this.md.value = 0})

    this.#setupKeywords()
    this.#setupLabels()
    this.#setupVariables()
  }
  #mouseMoved(event){
    this.mx.value = event.offsetX
    this.my.value = event.offsetY
  }
  
  #isl_canvas(width, height){
    ISLInterpreter.validateNum("canvas", ["width", width], ["height", height])
    if(typeof width === "number" && typeof height === "number"){
      /** @type {HTMLCanvasElement} */
      const cnv = this.#canvas ?? GraphicsExtension.#createHTMLElement("canvas")
      this.#canvas = cnv
      cnv.setAttribute("width", width)
      cnv.setAttribute("height", height)
      cnv.onmousemove = event => {this.#mouseMoved(event)}
      cnv.onmousedown = event => {this.md.value = 1}
    }
    else{
      if(typeof width === "number"){
        throw new ISLError("Canvas height must be a number, got "+ typeof height, TypeError)
      }
      else{
        throw new ISLError("Canvas width must be a number, got "+ typeof width, TypeError)
      }
    }
  }
  #isl_rect(labels, x, y, width, height){
    this.#checkCTX()
    ISLInterpreter.validateNum("rectangle", ["x",x], ["y", y], ["width", width], ["height", height])
    const context = this.#getRenderContext()
    {
      x -= width/2
      y -= height/2
      if(labels.includes("aligned")){
        if(labels.includes("left")){
          x += width/2
        }
        else if(labels.includes("right")){
          x -= width
        }
        else{
          throw new ISLError("'aligned' requires a direction: 'left' or 'right'", SyntaxError)
        }
      }
    }
    {
      context.beginPath();
      context.lineWidth = this.#canvasSettings.outlineWidth;
      context.strokeStyle = this.#canvasSettings.outlineColour ?? "#ff0000";
      context.fillStyle = this.#canvasSettings.fillColour ?? "#ff0000";
      context.rect(x, y, width, height);
      let drawn = false
      if(labels.includes("filled")){
        context.fill();
        drawn = true
      }
      if(labels.includes("hollow")){
        context.stroke();
        drawn = true
      }
      if(!drawn){
        context.fill();
        context.stroke();
      }
    }
  }
  #isl_circle(labels, x, y, radius){
    this.#checkCTX()
    ISLInterpreter.validateNum("circle", ["x",x], ["y", y], ["radius", radius])
    const context = this.#getRenderContext()
    {
      if(labels.includes("aligned")){
        if(labels.includes("left")){
          x += width/2
        }
        else if(labels.includes("right")){
          x -= width/2
        }
        else{
          throw new ISLError("'aligned' requires a direction: 'left' or 'right'", SyntaxError)
        }
      }
    }
    {
      context.beginPath();
      context.lineWidth = this.#canvasSettings.outlineWidth;
      context.strokeStyle = this.#canvasSettings.outlineColour ?? "#ff0000";
      context.fillStyle = this.#canvasSettings.fillColour ?? "#ff0000";
      context.arc(x, y, radius, 0, Math.PI * 2);
      let drawn = false
      if(labels.includes("filled")){
        context.fill();
        drawn = true
      }
      if(labels.includes("hollow")){
        context.stroke();
        drawn = true
      }
      if(!drawn){
        context.fill();
        context.stroke();
      }
    }
  }
  #isl_ellipse(labels, x, y, width, height){
    this.#checkCTX()
    ISLInterpreter.validateNum("ellipse", ["x",x], ["y", y], ["width", width], ["height", height])
    const context = this.#getRenderContext()
    {
      if(labels.includes("aligned")){
        if(labels.includes("left")){
          x += width/2
        }
        else if(labels.includes("right")){
          x -= width/2
        }
        else{
          throw new ISLError("'aligned' requires a direction: 'left' or 'right'", SyntaxError)
        }
      }
    }
    {
      context.beginPath();
      context.lineWidth = this.#canvasSettings.outlineWidth;
      context.strokeStyle = this.#canvasSettings.outlineColour ?? "#ff0000";
      context.fillStyle = this.#canvasSettings.fillColour ?? "#ff0000";
      context.ellipse(x, y, width/2, height/2, 0, 0, Math.PI * 2,);
      let drawn = false
      if(labels.includes("filled")){
        context.fill();
        drawn = true
      }
      if(labels.includes("hollow")){
        context.stroke();
        drawn = true
      }
      if(!drawn){
        context.fill();
        context.stroke();
      }
    }
  }
  #isl_text(labels, x, y, text, maxWidth = undefined){
    this.#checkCTX()
    ISLInterpreter.validateNum("text", ["x", x], ["y", y])
    ISLInterpreter.validateStr("text", ["text", text])
    if(typeof maxWidth !== "number" && typeof maxWidth !== "undefined"){
      throw new ISLError("'text' expects a number or undefined for argument 'maxWidth', got"+typeof maxWidth, TypeError)
    }
    const context = this.#getRenderContext()
    context.font = (this.#canvasSettings.textSize ?? 20)+"px "+(this.#canvasSettings.textFont ?? "Arial")
    const textmetrics = context.measureText(text)
    let width = textmetrics.width
    let height = textmetrics.actualBoundingBoxDescent + textmetrics.actualBoundingBoxAscent
    {
      x -= width/2
      y += height/2
      if(labels.includes("aligned")){
        if(labels.includes("left")){
          x += width/2
        }
        else if(labels.includes("right")){
          x -= width
        }
        else{
          throw new ISLError("'aligned' requires a direction: 'left' or 'right'", SyntaxError)
        }
      }
    }
    {
      context.lineWidth = this.#canvasSettings.outlineWidth;
      context.strokeStyle = this.#canvasSettings.outlineColour ?? "#ff0000";
      context.fillStyle = this.#canvasSettings.fillColour ?? "#ff0000";
      let drawn = false
      if(labels.includes("filled")){
        context.fillText(text, x, y, maxWidth);
        drawn = true
      }
      if(labels.includes("hollow")){
        context.strokeText(text, x, y, maxWidth);
        drawn = true
      }
      if(!drawn){
        context.fillText(text, x, y, maxWidth);
        context.strokeText(text, x, y, maxWidth);
      }
    }
  }
  #isl_bg(colour){
    this.#checkCTX()
    ISLInterpreter.validateStr("background", ["colour", colour])
    const context = this.#getRenderContext()
    context.beginPath();
    context.fillStyle = colour ?? "#000000";
    context.rect(0, 0, this.#getCanvas().getAttribute("width"), this.#getCanvas().getAttribute("height"));
    context.fill();
  }
  #isl_draw(){
    const len = this.#drawBuffer.length
    for(let i = 0; i < len; i++){
      let operation = this.#drawBuffer[i]
      Object.assign(this.#canvasSettings, operation.options)
      operation.type.apply(this, operation.params)
    }
    this.#drawBuffer = []
  }


  // move these to the top
  static #createHTMLElement(type, id){
    const eleFirstCheck = document.getElementById(id)
    if(!eleFirstCheck){
      const ele = document.createElement(type);
      if(id) ele.id = id
      document.body.appendChild(ele)
      return ele
    }
    return eleFirstCheck
  }
  #getCanvas(){
    return this.#canvas
  }
  /**
   * @returns {CanvasRenderingContext2D | null}
   */
  #getRenderContext(){
    return this.#getCanvas()?.getContext("2d")
  }

  #setupKeywords() {
    this.addKeyword("canvas", function(interpreter, labels, width, height){
      this.#isl_canvas(width, height)
    })
    this.addKeyword("rectangle", function(interpreter, labels, x, y, width, height){
      if(this.#bufferedGraphics){
        this.#drawBuffer.push({type: this.#isl_rect, params: [labels, x, y, width, height], options: structuredClone(this.#canvasSettings)})
      }
      else{
        this.#isl_rect(labels, x, y, width, height)
      }
    })
    this.addKeyword("ellipse", function(interpreter, labels, x, y, width, height){
      if(this.#bufferedGraphics){
        this.#drawBuffer.push({type: this.#isl_ellipse, params: [labels, x, y, width, height], options: structuredClone(this.#canvasSettings)})
      }
      else{
        this.#isl_ellipse(labels, x, y, width, height)
      }
    })
    this.addKeyword("circle", function(interpreter, labels, x, y, radius){
      if(this.#bufferedGraphics){
        this.#drawBuffer.push({type: this.#isl_circle, params: [labels, x, y, radius], options: structuredClone(this.#canvasSettings)})
      }
      else{
        this.#isl_circle(labels, x, y, radius)
      }
    })
    this.addKeyword("text", function(interpreter, labels, x, y, text, maxWidth){
      if(this.#bufferedGraphics){
        this.#drawBuffer.push({type: this.#isl_text, params: [labels, x, y, text, maxWidth], options: structuredClone(this.#canvasSettings)})
      }
      else{
        this.#isl_text(labels, x, y, text, maxWidth)
      }
    })
    this.addKeyword("background", function(interpreter, labels, colour){
      if(this.#bufferedGraphics){
        this.#drawBuffer.push({type: this.#isl_bg, params: [colour], options: structuredClone(this.#canvasSettings)})
      }
      else{
        this.#isl_bg(colour)
      }
    })
    this.addKeyword("draw", function(interpreter, labels){
      if(this.#bufferedGraphics){
        this.#isl_draw()
      }
    })
    this.addKeyword("textsize", function(interpreter, labels, size){
      ISLInterpreter.validateNum("textsize", ["size", parts[1]])
      this.#canvasSettings.textSize = parts[1]
    })
    this.addKeyword("fill", function(interpreter, labels, colour, alpha){
      if(labels.includes("no")){
        this.#canvasSettings.fillColour = "#00000000"
      }
      else{
        ISLInterpreter.validateStr("fill", ["colour", colour])
        ISLInterpreter.validateNum("fill", ["alpha", alpha, "optional"])
        this.#canvasSettings.fillColour = colour
        if(typeof alpha !== "undefined"){
          let input = clamp(alpha, 0, 255).toString(16)
          if(input.length < 2){
            input = "0" + input
          }
          this.#canvasSettings.fillColour += input
        }
      }
    })
    this.addKeyword("outline", function(interpreter, labels, colour, width){
      if(labels.includes("no")){
        this.#canvasSettings.fillColour = "#00000000"
      }
      else{
        ISLInterpreter.validateStr("outline", ["colour", colour])
        ISLInterpreter.validateNum("outline", ["width", width, "optional"])
        this.#canvasSettings.outlineColour = colour
        if(typeof width !== "undefined"){
          this.#canvasSettings.outlineWidth = width
        }
      }
    })
    this.addKeyword("save", function(interpreter, labels){
      this.#checkCTX()
      this.#getRenderContext().save()
    })
    this.addKeyword("restore", function(interpreter, labels){
      this.#checkCTX()
      this.#getRenderContext().restore()
    })
  }
  #checkCTX() {
    if(!this.#getRenderContext()) throw new ISLError("Cannot perform a graphics operation without a canvas!", SyntaxError)
  }
  #setupVariables() {
    this.mx = this.addVariable("mx", 0)
    this.my = this.addVariable("my", 0)
    this.md = this.addVariable("md", 0)
  }
  #setupLabels() {
    this.addLabel("filled", ["rectangle", "circle", "ellipse"])
    this.addLabel("hollow", ["rectangle", "circle", "ellipse"])
    this.addLabel("no", ["outline", "fill"])
    this.addLabel("right", ["text", "ellipse", "circle", "rectangle"])
    this.addLabel("left", ["text", "ellipse", "circle", "rectangle"])
    this.addLabel("aligned", ["text", "ellipse", "circle", "rectangle"])
  }
}

function clamp(number, min, max) {
  return Math.min(Math.max(number, min), max);
}

export { GraphicsExtension }