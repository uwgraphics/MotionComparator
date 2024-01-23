import React, { Component, createRef } from "react";
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

export interface labeled_slider_props {
    label?:string,
    min?:number,
    step?:number,
    max?:number,
    value?:number,
    onChange?: (newValue:number) => void,
    onMouseUp?: (newValue: number) => void, // a function that is called when the user releases the mouse
}

interface labeled_slider_state { 
    textValue: string,
    sliderValue: string,
    prevPropValue:string,
}

const INT_CHARS = "0123456789";

/**
 * Panel for displaying general information about each robot in the scene and
 * allowing you to select one of them.
 */
export class LabeledSlider extends Component<labeled_slider_props, labeled_slider_state> {
    // These never change after initial creation but are not directly in props
    // so keep them apart from state (which should change after creation) and
    // props (which is read-only)

    protected _textInput: React.RefObject<HTMLInputElement>;
    protected _sliderInput: React.RefObject<HTMLInputElement>;

    constructor(props:labeled_slider_props) {
        super(props);

        this.onTextInputChange = this.onTextInputChange.bind(this);
        this.onTextInputKeyDown = this.onTextInputKeyDown.bind(this);
        this.onSliderChange = this.onSliderChange.bind(this);

        this._textInput = createRef();
        this._sliderInput = createRef();

        let value = this.value().toString();

        this.state = {
            textValue: value, // value of text input
            sliderValue: value, // value of slider
            prevPropValue: value,
        }
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
        this.setState({ textValue: newValue });
    }

    onTextInputKeyDown(event:any) {
        if (event.key.toLowerCase() === "enter" || event.code.toLowerCase() === "enter") {
            // Now that enter has been pressed, change the state so that the
            // slider has the new value.
            let textInput = event.target;
            if (textInput) {
                let newValue = clamp(Number(textInput.value), this.min(), this.max());
                let onChange = this.props.onChange;

                this.setState({
                    textValue: newValue.toString(),
                    sliderValue: newValue.toString(),
                }, () => {
                    if (onChange) onChange(Number(newValue));
                });
            }
        } else if (event.key.toLowerCase() === "escape" || event.code.toLowerCase() === "escape") {
            // Just reset the textinput's value to the slider's value
            this.setState({
                textValue: this.state.sliderValue,
            });
        }
    }

    onSliderChange(event:React.FormEvent<HTMLInputElement>) {
        let newValue = event.currentTarget.value;
        let onChange = this.props.onChange;
        this.setState({
            sliderValue: newValue,
            textValue: newValue,
        }, () => {
            if (onChange) onChange(Number(this.state.sliderValue));
        });
    }

    /**
     * This is run after every time the render() method is run to check whether
     * new props have been given. If so, then it sets the bar to reflect those
     * new props only if the bar is not hovered (i.e. the user is not actively
     * changing the value of the inputs).
     */
    componentDidUpdate(prevProps:labeled_slider_props, prevState:labeled_slider_state) {
        if (!(isHovered(this._textInput.current) || isFocused(this._textInput.current)
                || isHovered(this._sliderInput.current))
                && (this.value().toString() !== this.state.prevPropValue))  {
            // If neither inputs are hovered and the given props have changed,
            // then change to the new props.
            let value = this.value().toString();
            this.setState({
                textValue: value,
                sliderValue: value,
                prevPropValue: value,
            });
        }
    }

    render() {
        // Only have a label if one is given
        let label;
        if (this.props.label) {
            label = (
                <div className="labelDiv">
                    <label>{this.props.label}</label>
                </div>
            );
        } else {
            label = undefined;
        }
        let onMouseUp = this.props.onMouseUp;
        return (
            <div className = "LabeledSlider">
                {label}
                <div className="inputDiv">
                    <input type="text" 
                           value={this.state.textValue}
                           onKeyDown={this.onTextInputKeyDown}
                           onChange={this.onTextInputChange}
                           ref={this._textInput}
                    />
                    <input type="range"
                           max={this.max()}
                           min={this.min()}
                           step={this.step()}
                           value={this.state.sliderValue}
                           onChange={this.onSliderChange}
                           onMouseUp={() => {if(onMouseUp) onMouseUp(Number(this.state.sliderValue))}}
                           ref={this._sliderInput}
                    />
                </div>
            </div>
        );
    }

    // Helper functions

    protected min():number {
        return this.props.min ?? 0;
    }

    protected max():number {
        return Math.max(this.min(), this.props.max ?? 1); // If min larger than, min set max equal to min
    }

    protected value() {
        let val = this.props.value;
        return clamp(val === undefined ? this.min() : val, this.min(), this.max());
    }

    protected step():number | undefined {
        return this.props.step;
    }
}