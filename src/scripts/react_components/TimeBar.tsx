import React, { Component, MouseEvent, createRef } from 'react';
import { clamp } from "../helpers";

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
    step?:number, 
    absStartTime?:number,  // start of entire timebar ->usually 0
    currStartTime?:number, // start of selected time
    currTime?:number,      // the current time
    currEndTime?:number,   // end of selected time
    absEndTime?:number,    // end of entire timebar ->usually 0
    height?: number,
    onChange: (newValue:number) => void,
    onStartChange: (newValue:number) => void,
    onEndChange: (newValue:number) => void,
    event_x?: number,
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

export class TimeBar extends Component<time_bar_props, time_bar_state> {
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
        fill: '#fff',
        stroke: '#666',
        intFill: '#808080',
        valFill: '#f88',
        step: 0.001,
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
        return (<rect stroke={TimeBar.defaultProps.stroke} 
                      fill={TimeBar.defaultProps.fill} 
                      x={TimeBar.defaultProps.x+'px'} 
                      y={TimeBar.defaultProps.y+'px'} 
                      width={this.width()+'px'} 
                      height={TimeBar.defaultProps.height+'px'} />);   
    }

    /**
     * handle the users click on the time bar
     * set the current time to the clicked value
     * @param event 
     */
    onClickSelectedInterval(event: any)
    {
        const {currStart, currEnd} = this.state;
        const length = this.max()-this.min();
        const startLoc = currStart/length * this.width();
        // calculate the value based on the x offset
        const xOffset = event.nativeEvent.offsetX - (TimeBar.defaultProps.x + startLoc);
        // console.log(rectX);
        const currWidth = clamp((currEnd - currStart)/length * this.width(), 0, this.width());
        const newValue = currStart + (currEnd - currStart) * (xOffset / currWidth);
        this.props.onChange(newValue);
        this.setState({
            currValue: newValue,
            textValue: newValue.toFixed(this.getStep()),
        })
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
        return (<rect stroke={TimeBar.defaultProps.stroke} fill={TimeBar.defaultProps.intFill} fillOpacity="50%" x={(TimeBar.defaultProps.x+startLoc)+'px'} y={TimeBar.defaultProps.y+'px'} width={currWidth+'px'} height={TimeBar.defaultProps.height+'px'} onClick={this.onClickSelectedInterval.bind(this)}/>);
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
        return (<rect stroke={TimeBar.defaultProps.stroke} fill={TimeBar.defaultProps.valFill} fillOpacity="50%" x={(TimeBar.defaultProps.x+startLoc)+'px'} y={TimeBar.defaultProps.y+'px'} width={currWidth+'px'} height={TimeBar.defaultProps.height+'px'} onClick={this.onClickSelectedInterval.bind(this)}/>);
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

    /**
     * this function deals with dragging outside of the timebar
     * it will be called in the componentdidupdate function to react
     * to the mouse move in the animation panel
     * @param event_x 
     */
    dragfromotherplace(event_x: number){
        const {currStart, currValue, currEnd, mouseXCoord} = this.state;
        const length = this.max()-this.min();
        const change = (event_x - mouseXCoord)/this.width() * length;
        if (this.state.dragStart) {
            const newStart = clamp(change+currStart, this.min(), currEnd);
            //console.log({pageX: e.pageX, origin:mouseXCoord, change, newStart, actualS:Number(newStart.toFixed(this.getStep()))});
            const newValue = clamp(currValue, newStart, currValue);
            if(newStart !== currStart){
                if(newValue !== currValue){
                    this.setState({
                        currStart: newStart,//Number(newEnd.toFixed(this.getStep())),
                        textStartValue: newStart.toFixed(this.getStep()),
                        mouseXCoord: event_x,
                        currValue: newValue,
                        textValue: newValue.toFixed(this.getStep())
                    });
                    this.props.onChange(newValue);
                    this.props.onStartChange(newStart);
                }else{
                    this.setState({
                        currStart: newStart,//Number(newEnd.toFixed(this.getStep())),
                        textStartValue: newStart.toFixed(this.getStep()),
                        mouseXCoord: event_x
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
                    mouseXCoord: event_x
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
                        mouseXCoord: event_x,
                        currValue: newValue,
                        textValue: newValue.toFixed(this.getStep())
                    });
                    this.props.onChange(newValue);
                    this.props.onEndChange(newEnd);
                }else{
                    this.setState({
                        currEnd: newEnd,//Number(newEnd.toFixed(this.getStep())),
                        textEndValue: newEnd.toFixed(this.getStep()),
                        mouseXCoord: event_x
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
        // Only update the values of this time bar if it is not hovered (i.e.
        // the user is not trying to control it right now).
        if (
            //!(this.state.dragStart || this.state.dragValue || this.state.dragEnd) &&
            !(isHovered(this._textInput.current) || isFocused(this._textInput.current)) &&
            !(isHovered(this._textInputStart.current) || isFocused(this._textInputStart.current)) &&
            !(isHovered(this._textInputEnd.current) || isFocused(this._textInputEnd.current)) &&
            !(isHovered(this._timeBarDiv.current) || isFocused(this._timeBarDiv.current))
        ) {
            if (this.value().toString() !== this.state.prevPropValue) {
                // If neither inputs are hovered and the given props have changed,
                // then change to the new props.
                let value = this.value();
                this.setState({
                    textValue: value.toFixed(this.getStep()),
                    currValue: value,
                    prevPropValue: value.toString(),
                });
            }else if(this.props.currEndTime && this.state.currEnd !== this.props.currEndTime){
                this.setState({
                    textEndValue: this.props.currEndTime.toFixed(this.getStep()),
                    currEnd: this.props.currEndTime,
                });
            }else if(this.props.currStartTime && this.state.currStart !== this.props.currStartTime){
                this.setState({
                    textStartValue: this.props.currStartTime.toFixed(this.getStep()),
                    currStart: this.props.currStartTime,
                });
            }
            // else if(prevProps.min !== this.props.min || prevProps.max !== this.props.max){
            //     console.log("time has changed");
            //     let min = this.min();
            //     let max = this.max();
            //     this.setState({
            //         currStart: min,
            //         currEnd: max,
            //         textStartValue: min.toFixed(this.getStep()),
            //         textEndValue: max.toFixed(this.getStep()),
            //     });
            // }
        }

        // react to the mouse move in the animation panel
        const {event_x} = this.props; 
        if(prevProps.event_x !== event_x && event_x !== undefined)
        {
            this.dragfromotherplace(event_x);
        }
    }

    renderStartBar(){
        const currLoc = this.getCurrLoc();
        let x=(currLoc.start + 4.5)+'px';
        let y=TimeBar.defaultProps.drag_bar_y+'px';
        let size = TimeBar.defaultProps.drag_bar_height;
        let width = 3 * size / 8;
        let points = `${width},${size} 0,${size / 2} ${width},0`;

        return (
            <svg x={x} y={y} width={size + 'px'} height={size + 'px'} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg"
                onMouseDown={e => {
                    // Record our starting point.
                    this.setState({
                        dragStart: true,
                        mouseXCoord: e.pageX
                    });
                    this.attachDragEndListener();
                }}>
                <polygon points={points} fill={'#999'} />
            </svg>
        );
    }

    renderEndBar(){
        const currLoc = this.getCurrLoc();
        let x=(currLoc.end + TimeBar.defaultProps.x)+'px';
        let y=TimeBar.defaultProps.drag_bar_y+'px';
        let size = TimeBar.defaultProps.drag_bar_height;
        let width = 3 * size / 8;
        let points = `0,${size} ${width},${size / 2} 0,0`;

        return (
            <svg x={x} y={y} width={size + 'px'} height={size + 'px'} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg"
                onMouseDown={e => {
                    // Record our starting point.
                    this.setState({
                        dragEnd: true,
                        mouseXCoord: e.pageX
                    });
                    this.attachDragEndListener();
                }}>
                <polygon points={points} fill={'#999'} />
            </svg >
        );
    }

    renderCurrBar(){
        const currLoc = this.getCurrLoc();
        let size = TimeBar.defaultProps.drag_bar_height;
        let height = size / 2;
        let points = `0,0 ${size/2},${height} ${size},0`;
        let x=(currLoc.val + TimeBar.defaultProps.x - size/2)+'px';
        let y=(TimeBar.defaultProps.drag_bar_y - height / 2)+'px';
        return (
            <svg x={x} y={y} width={size + 'px'} height={size + 'px'} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg"
                onMouseDown={e => {
                    // Record our starting point.
                    this.setState({
                        dragValue: true,
                        mouseXCoord: e.pageX
                    }); 
                    this.attachDragEndListener();
                }}>
                <polygon points={points} fill={'#555'} />
            </svg >
        );
    }

    render() {
        //ToDO change svg style to center
        const currLoc = this.getCurrLoc();
        const style = {color: "rgb(183, 183, 189)", backgroundColor: "rgb(23, 24, 25)"};
        return (
            <div className="TimeBar" /*onMouseMove={this.drag}*/>
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
                <div ref={this._timeBarDiv} className='timeBarDiv' style={{"height": `${30}px`}}>
                    <svg width={`${this.state.timeBarWidth}px`} height={`${this.props.height}px`} /*onMouseMove={this.drag}*/> 
                        {this.renderBackground()}
                        {this.renderSelectedInterval()}
                        {this.renderValueInterval()}
                        {this.renderStartBar()}
                        {this.renderEndBar()}
                        {this.renderCurrBar()}
                        {/* <rect 
                            fill={'#999'} 
                            x={(currLoc.start + 4.5)+'px'} 
                            y={TimeBar.defaultProps.drag_bar_y+'px'} 
                            width={'6px'} 
                            height={TimeBar.defaultProps.drag_bar_height+'px'} 
                            onMouseDown={e => {
                                // Record our starting point.
                                this.setState({
                                    dragStart: true,
                                    mouseXCoord: e.pageX
                                }); 
                                this.attachDragEndListener();
                            }}/> */}

                        {/* <rect 
                            fill={'#999'} 
                            x={(currLoc.end+TimeBar.defaultProps.x)+'px'} 
                            y={TimeBar.defaultProps.drag_bar_y+'px'} 
                            width={'6px'} 
                            height={TimeBar.defaultProps.drag_bar_height+'px'} 
                            onMouseDown={e => {
                                // Record our starting point.
                                this.setState({
                                    dragEnd: true,
                                    mouseXCoord: e.pageX
                                }); 
                                this.attachDragEndListener();
                            }}/> */}
                        {/* <rect 
                            fill={'#555'} 
                            x={(currLoc.val+TimeBar.defaultProps.x)+'px'} 
                            y={TimeBar.defaultProps.drag_bar_y+'px'} 
                            width={'4px'} 
                            height={TimeBar.defaultProps.drag_bar_height+'px'} 
                            onMouseDown={e => {
                                // Record our starting point.
                                this.setState({
                                    dragValue: true,
                                    mouseXCoord: e.pageX
                                }); 
                                this.attachDragEndListener();
                            }}/> */}


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
        return this.props.absStartTime ?? 0;
    }

    protected max():number {
        return Math.max(this.min(), this.props.absEndTime ?? 1); // If min larger than, min set max equal to min
    }
    protected width():number {
        // 20 because each of the start and end bars is 20px wide, so 10 is
        // added to the x and now 20 must be subtracted from the total width to
        // make up for that and the end bar.
        return (this.state.timeBarWidth ?? TimeBar.defaultProps.width) - 20; 
    }

    protected value() {
        let val = this.props.currTime;
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
        const step = (this.props.step ?? TimeBar.defaultProps.step).toString();
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