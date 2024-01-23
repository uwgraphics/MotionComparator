import React, { Component, MouseEvent, createRef } from 'react';
import { clamp } from "../helpers";
import * as d3 from "d3";

function isHovered(element?:HTMLElement | null):boolean {
    if (!element) return false; // can't be hovered because doesn't exist
    let parent = element.parentElement;
    if (parent) {
        return parent.querySelector(':hover') === element;
    }
    return false; // no parent so default to not hovered
}

function isFocused(element?:HTMLElement | null):boolean {
    if (!element) return false; // can't be focused because doesn't exist
    let parent = element.parentElement;
    if (parent) {
        return parent.querySelector(':focus') === element;
    }
    return false; // no parent so default to not focused
}

export interface time_bar_props {
    label?:string,
    absStart?:number, // start of entire timebar ->usually 0
    step?:number, 
    absEnd?:number, // end of entire timebar ->usually 0
    start?:number, // start of selected time
    end?:number,
    value?:number,
    width?:number,
    color_level?:number[][],
    onChange: (newValue:number) => void,
    onStartChange: (newValue:number) => void,
    onEndChange: (newValue:number) => void,

}

interface time_bar_values {
    start: number,
    end: number,
    val: number,
}

interface time_bar_state { 
    timeBarWidth: number,
    textValue: string,
    textStartValue: string,
    textEndValue: string,

    currValue: number, //current time value
    currStart: number, // start of interval
    currEnd: number, // end of interval

    prevPropValue:string,

    dragStart: boolean, //dragging the start traveller
    dragValue: boolean, //dragging the slider
    dragEnd: boolean, //dragging the end traveller
    mouseXCoord: number //only need x coordinate
}
const INT_CHARS = "0123456789";
const colors = d3.schemeSet1;
export class ColoredTimeBar extends Component<time_bar_props, time_bar_state> {
    protected _textInput: React.RefObject<HTMLInputElement>;
    protected _textInputStart: React.RefObject<HTMLInputElement>;
    protected _textInputEnd: React.RefObject<HTMLInputElement>;
    protected _time_bar_resize_observer?: ResizeObserver;
    protected _timeBarDiv: React.RefObject<HTMLDivElement>;
    
    static defaultProps = {
        drag_bar_height: 20,
        drag_bar_y: 5,
        height: 5,
        width: 700,
        x:10,
        y:12,
        // travellerWidth: 5,
        gap: 1,
        fill: '#ffffff',
        stroke: '#444444',
        intFill: '#808080',
        valFill: '#555555',
        leaveTimeOut: 1000,
        label: "",
        min: 0,
        step: 0.001,
        max: 1,
        value: 0,
        colorSpectrum: [colors[1], '#ffffff', colors[0]] //[slowest, unmodified, largest]
    };
    
    constructor(props: time_bar_props) {
        super(props);
        //check if value is legit?
        
        this.state = {
            timeBarWidth: 400,
            textValue: this.value().toFixed(this.getStep()),
            textStartValue: this.min().toFixed(this.getStep()),
            textEndValue: this.max().toFixed(this.getStep()),
            currValue: this.value(),
            currStart: this.min(), // start of interval
            currEnd: this.max(), // end of interval
            prevPropValue: this.value().toString(),
            dragStart: false,
            dragValue: false,
            dragEnd: false,
            mouseXCoord: 0,
        };
        
        this.drag = this.drag.bind(this);
        this.handleDragEnd = this.handleDragEnd.bind(this);
        this._textInput = createRef();
        this._textInputStart = createRef();
        this._textInputEnd = createRef();
        this._timeBarDiv = createRef();
        this.onTextInputChange = this.onTextInputChange.bind(this);
        this.onTextInputKeyDown = this.onTextInputKeyDown.bind(this);
        this.onTextInputStartChange = this.onTextInputStartChange.bind(this);
        this.onTextInputStartKeyDown = this.onTextInputStartKeyDown.bind(this);
        this.onTextInputEndChange = this.onTextInputEndChange.bind(this);
        this.onTextInputEndKeyDown = this.onTextInputEndKeyDown.bind(this);
    }

    /**
     * Draws the background for the time bar
     * @returns svg rect element
     */
    renderBackground(){
        const {color_level} = this.props;
        
        if(!color_level || color_level.length <= 1){
            return (<rect stroke={ColoredTimeBar.defaultProps.stroke} 
                        fill={ColoredTimeBar.defaultProps.fill} 
                        x={ColoredTimeBar.defaultProps.x+'px'} 
                        y={ColoredTimeBar.defaultProps.y+'px'} 
                        width={this.width()+'px'} 
                        height={ColoredTimeBar.defaultProps.height+'px'} />);   
        }

        // the width of each small rectangle that will make up the timebar
        // let width = this.width()/color_level.length; 
        // max will have 
        let unitWidth = this.width()/(this.max() - this.min());
        let max = color_level[1][0];
        let min = color_level[1][0];
        for(const i of color_level[1]){
            if(i > max) max = i;
            if(i < min) min = i;
        }
        let result = [];
        // result.push(<rect
        //     fill={"#fff"} 
        //     x={ColoredTimeBar.defaultProps.x +'px'} 
        //     y={ColoredTimeBar.defaultProps.y+'px'} 
        //     width={this.width()+'px'} 
        //     height={ColoredTimeBar.defaultProps.height+'px'} />);
        
        if(color_level[0][0] > this.min()){
            let width = unitWidth * (color_level[0][0] - this.min()); 
            let x = ColoredTimeBar.defaultProps.x;
            result.push(<rect 
                stroke={"#fff"} 
                fill={"#fff"} 
                x={x +'px'} 
                y={ColoredTimeBar.defaultProps.y+'px'} 
                width={width+'px'} 
                height={ColoredTimeBar.defaultProps.height+'px'} />);
        }
        let prev_color = "#fff";
        for(let i = 0; i < color_level[0].length; i++){
            //let color = color_level[1][i] >= 0? this.scaleColorEntry(max, color_level[1][i]): this.scaleColorEntry( min, color_level[1][i]);
            let color = color_level[1][i] >= 0? this.interpolateColor(max, color_level[1][i], ColoredTimeBar.defaultProps.colorSpectrum[2])
            : this.interpolateColor(-min, -color_level[1][i], ColoredTimeBar.defaultProps.colorSpectrum[0]);
            let width = (i < (color_level[0].length - 1)) ? 
                (unitWidth * (color_level[0][i+1] - color_level[0][i])) : 
                (unitWidth * (this.max() - color_level[0][i])); 
            let x = unitWidth * (color_level[0][i]-this.min()) + ColoredTimeBar.defaultProps.x;
            // console.log("index: " + i+" width: "+width + " x: "+ x+" color: "+color);
            // console.log(" content " + color_level[0][i] + " " + color_level[1][i]);
            result.push(
                <svg>
                    <linearGradient id={`gradient${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={prev_color} />
                        <stop offset="100%" stopColor={color} />
                    </linearGradient>
                    <rect
                        // stroke={ColoredTimeBar.defaultProps.stroke} 
                        key={"coloredTimeBar" + i}
                        stroke={`url(#gradient${i})`}
                        fill={`url(#gradient${i})`}
                        x={x + 'px'}
                        y={ColoredTimeBar.defaultProps.y + 0.5 + 'px'}
                        width={width + 'px'}
                        height={ColoredTimeBar.defaultProps.height - 1 + 'px'} />
                </svg>
            );
            prev_color = color;
        }
        return result;
        //console.log(color_level);
        
    }
    /**
     * Calculate what num is scaled from 0 to F for coloring
     * @param max represents 0
     * @param num 
     */
    scaleColorEntry(max:number, num:number):string{
        if(num === 0){
            return ColoredTimeBar.defaultProps.colorSpectrum[1];
        }
        let entry = 230 - Math.round((num/max) * 230);
        let result = entry.toString(16);
        result = result.length === 1 ? '0' + result : result;
        // let letters = ["a", "b", "c", "d", "e", "f"];
        let extreme = ColoredTimeBar.defaultProps.colorSpectrum[(num<0)?0:1];
        if(num > 0){
            return extreme.substring(0, 3) + result + result;
        }else{
            return extreme.substring(0, 1) + result + result + extreme.substring(5);
        }

    }
    interpolateColor(max: number, num: number, color: string): string {
        // // Normalize num to be in the range [0, 1]
        // const normalizedNum = Math.min(Math.max(num / max, 0), 1);
      
        // Create a color scale that interpolates between the given color and "white"
        const colorScale = d3.scaleLinear()
          .domain([0, max])
          .range(['white', color]);
      
        // Use the color scale to interpolate the color based on the normalizedNum
        return colorScale(num);
    }


    /**
     * Draws selected time interval
     * @returns svg rect element
     */
     renderSelectedInterval(){
        const {currStart, currEnd} = this.state;
        // const currStart = 0.2;
        // const currEnd = 0.8;
        const length = this.max()-this.min();
        const currWidth = clamp((currEnd - currStart)/length * this.width(), 0, this.width());
        const startLoc = currStart/length * this.width();
        //const fullWidth = this.width();
        // console.log({length, currWidth, startLoc, fullWidth});
        return (<rect stroke={ColoredTimeBar.defaultProps.stroke} 
                      fill={ColoredTimeBar.defaultProps.intFill} 
                      fillOpacity="30%" x={(ColoredTimeBar.defaultProps.x+startLoc)+'px'} 
                      y={ColoredTimeBar.defaultProps.y+'px'} 
                      width={currWidth+'px'} 
                      height={ColoredTimeBar.defaultProps.height+'px'} />);
    }
    
    /**
     * Draws "played" interval
     * @returns svg rect element
     */
     renderValueInterval(){
        const {currStart, currValue, currEnd} = this.state;
        // const currStart = 0.2;
        // const currValue = 0.3;
        const length = this.max()-this.min();
        const currWidth = clamp(currValue - currStart, 0, currEnd-currStart)/length * this.width();
        const startLoc = currStart/length * this.width();
        //const fullWidth = this.width();
        // console.log({length, currWidth, startLoc, fullWidth});
        return (<rect stroke={ColoredTimeBar.defaultProps.stroke} 
                      fill={ColoredTimeBar.defaultProps.valFill} 
                      fillOpacity="20%" x={(ColoredTimeBar.defaultProps.x+startLoc)+'px'} 
                      y={ColoredTimeBar.defaultProps.y+'px'} 
                      width={currWidth+'px'} 
                      height={ColoredTimeBar.defaultProps.height+'px'} />);
    }
    onTextInputChange(event:React.FormEvent<HTMLInputElement>) {
        let value = event.currentTarget.value; // textInput's current value

        // Make sure that the value is valid number
        let newValue = "";
        let numDecimals = 0;

        for (let i = 0; i < value.length; i++) {
            const c = value[i];

            if (INT_CHARS.includes(c)) {
                newValue += c; // numeral
            } else if (numDecimals === 0 && c === ".") {
                newValue += c; // first decimal point
                numDecimals++;
            } else if (newValue.length === 0 && c === "-") {
                newValue += c; // - sign at beginning of number
            }
        }
        // Set it as the new number that the input contains.
        this.setState({ 
            textValue: newValue,//Number(newValue).toFixed(this.getStep()), 
            //currValue: Number(newValue)//Uncomment if want bar to change as typing 
        });
    }

    onTextInputKeyDown(event:any) {
        if (event.key.toLowerCase() === "enter" || event.code.toLowerCase() === "enter") {
            // Now that enter has been pressed, change the state so that the
            // slider has the new value.
            let textInput = event.target;
            if (textInput) {
                let newValue = clamp(Number(textInput.value), this.state.currStart, this.state.currEnd);
                let onChange = this.props.onChange;

                this.setState({
                    textValue: newValue.toString(),
                    currValue: newValue,
                }, () => {
                    if (onChange) onChange(Number(newValue));
                });
            }
        } else if (event.key.toLowerCase() === "escape" || event.code.toLowerCase() === "escape") {
            // Just reset the textinput's value to the slider's value
            this.setState({
                textValue: this.state.currValue.toFixed(this.getStep()),
            });
        }
    }

    onTextInputStartChange(event:React.FormEvent<HTMLInputElement>) {
        let value = event.currentTarget.value; // textInput's current value

        // Make sure that the value is valid number
        let newValue = "";
        let numDecimals = 0;

        for (let i = 0; i < value.length; i++) {
            const c = value[i];

            if (INT_CHARS.includes(c)) {
                newValue += c; // numeral
            } else if (numDecimals === 0 && c === ".") {
                newValue += c; // first decimal point
                numDecimals++;
            } else if (newValue.length === 0 && c === "-") {
                newValue += c; // - sign at beginning of number
            }
        }
        // Set it as the new number that the input contains.
        this.setState({ 
            textStartValue: newValue,//Number(newValue).toFixed(this.getStep()), 
            //currStart: Number(newValue) 
        });
    }
    // BUG: if move start pushes value, then move start back, value isn't the previous start but previous value
    onTextInputStartKeyDown(event:any) {
        if (event.key.toLowerCase() === "enter" || event.code.toLowerCase() === "enter") {
            // Now that enter has been pressed, change the state so that the
            // slider has the new value.
            let textInput = event.target;
            if (textInput) {
                let newStart = clamp(Number(textInput.value), this.min(), this.state.currEnd);
                let newValue = clamp(this.state.currValue, newStart, this.state.currValue)
                let onChange = this.props.onChange;
                let onStartChange = this.props.onStartChange;
                if(newStart !== this.state.currStart){
                    if(newValue !== this.state.currValue){
                        this.setState({
                            textStartValue: newStart.toString(),
                            currStart: newStart,
                            textValue: newValue.toString(),
                            currValue: newValue,
                        }, () => {
                            if (onChange) onChange(Number(newValue));
                            if (onStartChange) onStartChange(Number(newStart));
                        });
                    }else{
                        this.setState({
                            textStartValue: newStart.toString(),
                            currStart: newStart
                        }, () => {
                            if (onStartChange) onStartChange(Number(newStart));
                        });
                    }
                }else{
                    this.setState({
                        textStartValue: newStart.toString(),
                    });
                }
                
            }
        } else if (event.key.toLowerCase() === "escape" || event.code.toLowerCase() === "escape") {
            // Just reset the textinput's value to the slider's value
            this.setState({
                textStartValue: this.state.currStart.toFixed(this.getStep()),
            });
        }
    }

    onTextInputEndChange(event:React.FormEvent<HTMLInputElement>) {
        let value = event.currentTarget.value; // textInput's current value

        // Make sure that the value is valid number
        let newValue = "";
        let numDecimals = 0;

        for (let i = 0; i < value.length; i++) {
            const c = value[i];

            if (INT_CHARS.includes(c)) {
                newValue += c; // numeral
            } else if (numDecimals === 0 && c === ".") {
                newValue += c; // first decimal point
                numDecimals++;
            } else if (newValue.length === 0 && c === "-") {
                newValue += c; // - sign at beginning of number
            }
        }
        // Set it as the new number that the input contains.
        this.setState({ 
            textEndValue: newValue,//Number(newValue).toFixed(this.getStep()), 
            //currEnd: Number(newValue) 
        });
    }

    onTextInputEndKeyDown(event:any) {
        if (event.key.toLowerCase() === "enter" || event.code.toLowerCase() === "enter") {
            // Now that enter has been pressed, change the state so that the
            // slider has the new value.
            let textInput = event.target;
            if (textInput) {
                // let newValue = clamp(Number(textInput.value), this.min(), this.max());
                // let onChange = this.props.onChange;

                // this.setState({
                //     textEndValue: newValue.toString(),
                //     currEnd: newValue,
                // }, () => {
                //     if (onChange) onChange(Number(newValue));
                // });
                let newEnd = clamp(Number(textInput.value), this.state.currStart, this.max());
                let newValue = clamp(this.state.currValue, this.state.currValue, newEnd)
                let onChange = this.props.onChange;
                let onEndChange = this.props.onEndChange;
                if(newEnd !== this.state.currEnd){
                    if(newValue !== this.state.currValue){
                        this.setState({
                            textEndValue: newEnd.toString(),
                            currEnd: newEnd,
                            textValue: newValue.toString(),
                            currValue: newValue,
                        }, () => {
                            if (onChange) onChange(Number(newValue));
                            if (onEndChange) onEndChange(Number(newEnd));
                        });
                    }else{
                        this.setState({
                            textEndValue: newEnd.toString(),
                            currEnd: newEnd
                        }, () => {
                            if (onEndChange) onEndChange(Number(newEnd));
                        });
                    }
                }else{
                    this.setState({
                        textEndValue: newEnd.toString(),
                    });
                }
            }
        } else if (event.key.toLowerCase() === "escape" || event.code.toLowerCase() === "escape") {
            // Just reset the textinput's value to the slider's value
            this.setState({
                textEndValue: this.state.currEnd.toFixed(this.getStep()),
            });
        }
    }


    attachDragEndListener() {
        window.addEventListener('mouseup', this.handleDragEnd, true);
        // window.addEventListener('mousemove', this.drag, true);
    }

    detachDragEndListener() {
        // window.removeEventListener('mouseup', this.endDrag, true);
        window.removeEventListener('mouseup', this.handleDragEnd, true);
    }
    handleDragEnd(){
        this.setState({
            dragStart: false,
            dragEnd: false,
            dragValue: false,
        });
        this.detachDragEndListener();
    }
    drag(e: MouseEvent){
        const {currStart, currValue, currEnd, mouseXCoord} = this.state;
        const length = this.max()-this.min();
        const change = (e.pageX - mouseXCoord)/this.width() * length;
        if (this.state.dragStart) {
            const newStart = clamp(change+currStart, this.min(), currEnd);
            //console.log({pageX: e.pageX, origin:mouseXCoord, change, newStart, actualS:Number(newStart.toFixed(this.getStep()))});
            const newValue = clamp(currValue, newStart, currValue);
            if(newStart !== currStart){
                if(newValue !== currValue){
                    this.setState({
                        currStart: newStart,//Number(newEnd.toFixed(this.getStep())),
                        textStartValue: newStart.toFixed(this.getStep()),
                        mouseXCoord: e.pageX,
                        currValue: newValue,
                        textValue: newValue.toFixed(this.getStep())
                    });
                    this.props.onChange(newValue);
                    this.props.onStartChange(newStart);
                }else{
                    this.setState({
                        currStart: newStart,//Number(newEnd.toFixed(this.getStep())),
                        textStartValue: newStart.toFixed(this.getStep()),
                        mouseXCoord: e.pageX
                    });
                    this.props.onStartChange(newStart);
                }
                
            }
           
                  
        } else if (this.state.dragValue) {
            const newValue = clamp(change+currValue, currStart, currEnd);
            // console.log({newValue, currStart, currValue, currEnd});
            if(newValue !== currValue){
                this.setState({
                    currValue: newValue,//Number(newValue.toFixed(this.getStep())),
                    textValue: newValue.toFixed(this.getStep()),
                    mouseXCoord: e.pageX
                });
                this.props.onChange(newValue);  
            }
        } else if (this.state.dragEnd) {
            const newEnd = clamp(change+currEnd, currStart, this.max());
            //console.log({pageX: e.pageX, origin:mouseXCoord, change, newEnd});
            const newValue = clamp(currValue, currValue, newEnd);
            if(newEnd !== currEnd){
                if(newValue !== currValue){
                    this.setState({
                        currEnd: newEnd,//Number(newEnd.toFixed(this.getStep())),
                        textEndValue: newEnd.toFixed(this.getStep()),
                        mouseXCoord: e.pageX,
                        currValue: newValue,
                        textValue: newValue.toFixed(this.getStep())
                    });
                    this.props.onChange(newValue);
                    this.props.onEndChange(newEnd);
                }else{
                    this.setState({
                        currEnd: newEnd,//Number(newEnd.toFixed(this.getStep())),
                        textEndValue: newEnd.toFixed(this.getStep()),
                        mouseXCoord: e.pageX
                    });
                    this.props.onEndChange(newEnd);
                }
                
            }
        }
    }

    componentDidMount(): void {
        this._time_bar_resize_observer = new ResizeObserver((entries)=>{
            // console.log(entries[0].contentRect);
            this.setState({
                timeBarWidth: entries[0].contentRect.width
            });
        });
        if(this._timeBarDiv && this._timeBarDiv.current){
            this._time_bar_resize_observer.observe(this._timeBarDiv.current);
        }
    }
    componentWillUnmount() {
        if (this._time_bar_resize_observer) {
          this._time_bar_resize_observer.disconnect();
        }
    }
    /**
     * This is run after every time the render() method is run to check whether
     * new props have been given. If so, then it sets the bar to reflect those
     * new props only if the bar is not hovered (i.e. the user is not actively
     * changing the value of the inputs).
     */
     componentDidUpdate(prevProps:time_bar_props, prevState:time_bar_state) {
        if (!(isHovered(this._textInput.current) || isFocused(this._textInput.current)
                /*|| isHovered(this._sliderInput.current)*/)
                && (this.value().toString() !== this.state.prevPropValue))  {
            // If neither inputs are hovered and the given props have changed,
            // then change to the new props.
            let value = this.value();
            this.setState({
                textValue: value.toFixed(this.getStep()),
                currValue: value,
                prevPropValue: value.toString(),
            });
        }else if(this.props.end && this.state.currEnd !== this.props.end){
            this.setState({
                textEndValue: this.props.end.toFixed(this.getStep()),
                currEnd: this.props.end,
            });
        }else if(this.props.start && this.state.currStart !== this.props.start){
            this.setState({
                textEndValue: this.props.start.toFixed(this.getStep()),
                currStart: this.props.start,
            });
        }
    }

    render() {
        //ToDO change svg style to center
        const currLoc = this.getCurrLoc();
        return(
            <div className="ColoredTimeBar">
                <div className='inputDiv'>
                    <input type="text" 
                        value={this.state.textStartValue}
                        onKeyDown={this.onTextInputStartKeyDown}
                        onChange={this.onTextInputStartChange}
                        ref={this._textInputStart}
                    />
                    <input type="text" 
                        value={this.state.textValue}
                        onKeyDown={this.onTextInputKeyDown}
                        onChange={this.onTextInputChange}
                        ref={this._textInput}
                    />
                </div>
                <div ref={this._timeBarDiv} className='timeBarDiv'>
                    <svg width={this.state.timeBarWidth} onMouseMove={this.drag}> 
                        {this.renderBackground()}
                        {this.renderSelectedInterval()}
                        {this.renderValueInterval()}
                        <rect 
                            fill={'#999'} 
                            x={(currLoc.start + 4.5)+'px'} 
                            y={ColoredTimeBar.defaultProps.drag_bar_y+'px'} 
                            width={'6px'} 
                            height={ColoredTimeBar.defaultProps.drag_bar_height+'px'} 
                            onMouseDown={e => {
                                // Record our starting point.
                                this.setState({
                                    dragStart: true,
                                    mouseXCoord: e.pageX
                                }); 
                                this.attachDragEndListener();
                            }}/>

                        <rect 
                            fill={'#999'} 
                            x={(currLoc.end+ColoredTimeBar.defaultProps.x)+'px'} 
                            y={ColoredTimeBar.defaultProps.drag_bar_y+'px'} 
                            width={'6px'} 
                            height={ColoredTimeBar.defaultProps.drag_bar_height+'px'} 
                            onMouseDown={e => {
                                // Record our starting point.
                                this.setState({
                                    dragEnd: true,
                                    mouseXCoord: e.pageX
                                }); 
                                this.attachDragEndListener();
                            }}/>
                        <rect 
                            fill={'#555'} 
                            x={(currLoc.val+ColoredTimeBar.defaultProps.x)+'px'} 
                            y={ColoredTimeBar.defaultProps.drag_bar_y+'px'} 
                            width={'4px'} 
                            height={ColoredTimeBar.defaultProps.drag_bar_height+'px'} 
                            onMouseDown={e => {
                                // Record our starting point.
                                this.setState({
                                    dragValue: true,
                                    mouseXCoord: e.pageX
                                }); 
                                this.attachDragEndListener();
                            }}/>
                    </svg>
                </div>
                <div className='inputDiv'>
                    <input type="text" 
                        value={this.state.textEndValue}
                        onKeyDown={this.onTextInputEndKeyDown}
                        onChange={this.onTextInputEndChange}
                        ref={this._textInputEnd}
                    />
                </div>
            </div>
        );
        
    }
    // Helper functions

    protected min():number {
        return this.props.absStart ?? 0;
    }

    protected max():number {
        return Math.max(this.min(), this.props.absEnd ?? 1); // If min larger than, min set max equal to min
    }
    protected width():number {
        return this.state.timeBarWidth*0.97 ?? ColoredTimeBar.defaultProps.width; 
    }

    protected value() {
        let val = this.props.value;
        if(this.state && this.state.currStart && this.state.currEnd){
            return clamp(val === undefined ? this.state.currStart : val, this.state.currStart, this.state.currEnd);
        }
        return clamp(val === undefined ? this.min() : val, this.min(), this.max());
    }

    protected step():number | undefined {
        return this.props.step;
    }
    protected getCurrLoc():time_bar_values{
        const {currStart, currEnd, currValue} = this.state;
        // const currStart = 0.2;
        // const currEnd = 0.8;
        const length = this.max()-this.min();
        const endLoc = currEnd/length * this.width();
        const startLoc = currStart/length * this.width();
        const currLoc = currValue/length * this.width();
        return {
            start: startLoc, 
            end: endLoc,
            val: currLoc
        };
    }
    /**
     * Get number of places to keep after decimal point
     * @returns number of places to keep after decimal point
     */
    protected getStep():number{
        const step = (this.props.step ?? ColoredTimeBar.defaultProps.step).toString();
        let counter = 0;
        let flag = false;
        for(let i = 0; i < step.length; i++){
            const c = step[i];
            if(c === "."){
                flag = true;
            }else if(flag){
                counter ++;
            }
        }
        return counter;
    }
}