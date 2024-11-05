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

    addEventListener("mouseup", () => {this.md.value = false})

    this.#setupKeywords()
    this.#setupLabels()
    this.#setupVariables()
    this.#setupTypes()
  }
  #mouseMoved(event){
    this.mx.value = event.offsetX
    this.my.value = event.offsetY
  }
  
  #isl_canvas(width, height){
    /** @type {HTMLCanvasElement} */
    const cnv = this.#canvas ?? GraphicsExtension.#createHTMLElement("canvas")
    this.#canvas = cnv
    cnv.setAttribute("width", width)
    cnv.setAttribute("height", height)
    cnv.onmousemove = event => {this.#mouseMoved(event)}
    cnv.onmousedown = event => {this.md.value = true}
  }
  #isl_rect(labels, x, y, width, height){
    this.#checkCTX()
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
      if(labels.includes("borderless")){
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
      if(labels.includes("borderless")){
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
      if(labels.includes("borderless")){
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
      if(labels.includes("borderless")){
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
      this.#isl_canvas(width.value, height.value)
    }, [
      {type: "number", name: "width"},
      {type: "number", name: "height"}
    ])
    this.addKeyword("rectangle", function(interpreter, labels, x, y, width, height){
        this.#drawBuffer.push({type: this.#isl_rect, params: [labels].concat([x, y, width, height].map(x => x?x.value:undefined)), options: structuredClone(this.#canvasSettings)})
    }, [
      {type: "number", name: "x"},
      {type: "number", name: "y"},
      {type: "number", name: "width"},
      {type: "number", name: "height"}
    ])
    this.addKeyword("ellipse", function(interpreter, labels, x, y, width, height){
        this.#drawBuffer.push({type: this.#isl_ellipse, params: [labels].concat([x, y, width, height].map(x => x?x.value:undefined)), options: structuredClone(this.#canvasSettings)})
    }, [
      {type: "number", name: "x"},
      {type: "number", name: "y"},
      {type: "number", name: "width"},
      {type: "number", name: "height"}
    ])
    this.addKeyword("circle", function(interpreter, labels, x, y, radius){
        this.#drawBuffer.push({type: this.#isl_circle, params: [labels].concat([x, y, radius].map(x => x?x.value:undefined)), options: structuredClone(this.#canvasSettings)})
    }, [
      {type: "number", name: "x"},
      {type: "number", name: "y"},
      {type: "number", name: "radius"}
    ])
    this.addKeyword("text", function(interpreter, labels, x, y, text, maxWidth){
        this.#drawBuffer.push({type: this.#isl_text, params: [labels].concat([x, y, text, maxWidth].map(x => x?x.value:undefined)), options: structuredClone(this.#canvasSettings)})
    }, [
      {type: "number", name: "x"},
      {type: "number", name: "y"},
      {type: "string", name: "text"},
      {type: "number", name: "maxWidth", optional: true}
    ])
    this.addKeyword("background", function(interpreter, labels, colour){
        this.#drawBuffer.push({type: this.#isl_bg, params: [colour.value], options: structuredClone(this.#canvasSettings)})
    }, [
      {type: "colour", name: "colour"}
    ])
    this.addKeyword("draw", function(interpreter, labels){
      if(this.#bufferedGraphics){
        this.#isl_draw()
      }
    })
    this.addKeyword("textsize", function(interpreter, labels, size){
      this.#canvasSettings.textSize = parts[1].value
    }, [
      {type: "number", name: "size"}
    ])
    this.addKeyword("fill", function(interpreter, labels, colour){
      if(labels.includes("no")){
        this.#canvasSettings.fillColour = "#00000000"
      }
      else{
        this.#canvasSettings.fillColour = colour.value
      }
    }, [
      {type: "colour", name: "colour"}
    ])
    this.addKeyword("outline", function(interpreter, labels, colour, width){
      if(labels.includes("no")){
        this.#canvasSettings.fillColour = "#00000000"
      }
      else{
        this.#canvasSettings.outlineColour = colour.value
        if(typeof width !== "undefined"){
          this.#canvasSettings.outlineWidth = width.value
        }
      }
    }, [
      {type: "colour", name: "colour"},
      {type: "number", name: "width", optional: true}
    ])
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
    this.md = this.addVariable("md", false)
  }
  #setupLabels() {
    this.addLabel("borderless", ["rectangle", "circle", "ellipse"])
    this.addLabel("hollow", ["rectangle", "circle", "ellipse"])
    this.addLabel("no", ["outline", "fill"])
    this.addLabel("right", ["text", "ellipse", "circle", "rectangle"])
    this.addLabel("left", ["text", "ellipse", "circle", "rectangle"])
    this.addLabel("aligned", ["text", "ellipse", "circle", "rectangle"])
  }
  #setupTypes(){
    this.addType("colour", value => isColor(value))
  }
}

function clamp(number, min, max) {
  return Math.min(Math.max(number, min), max);
}

function isColor(strColor) {
  const s = new Option().style;
  s.color = strColor;
  return s.color !== '';
}

export { GraphicsExtension }