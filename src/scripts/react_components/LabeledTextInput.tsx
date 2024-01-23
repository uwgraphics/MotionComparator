import { Component } from "react";

export interface labeled_text_input_props {
    labelValue?: string,
    value?: string, // Textbox value
    filter?: (newValue: string) => string, // Given the new value, return what the value of the input should now be
    onChange?: (newValue:string) => void,
    onReturnPressed?: (currValue:string) => void,
}

interface labeled_text_input_state {
    oldValue: string,  // Value to go to when Escape is pressed
    currValue: string, // current Textbox value
}

export class LabeledTextInput extends Component<labeled_text_input_props, labeled_text_input_state> {
    constructor(props:labeled_text_input_props) {
        super(props);

        this.onTextInputChange = this.onTextInputChange.bind(this);
        this.onTextInputKeyDown = this.onTextInputKeyDown.bind(this);

        this.state = {
            oldValue: this.props.value ?? "",
            currValue: this.props.value ?? "",
        }
    }
    onTextInputChange(event:React.FormEvent<HTMLInputElement>) {
        let value = event.currentTarget.value; // textInput's current value

        if (this.props.filter) value = this.props.filter(value);
        let onChange = this.props.onChange;

        // Set it as the new number that the input contains.
        this.setState({
            currValue: value
        }, () => {
            if (onChange) onChange(value);
        });
    }

    onTextInputKeyDown(event:any) {
        if (event.key.toLowerCase() === "enter" || event.code.toLowerCase() === "enter") {
            // Now that enter has been pressed, change the state so that this value is now
            // the old value (i.e. the value escape will make it go back to).
            let textInput = event.target;
            if (textInput) {
                let newValue:string = this.props.filter ? this.props.filter(textInput.value) : textInput.value;
                let onChange = this.props.onChange;
                let onReturnPressed = this.props.onReturnPressed;

                this.setState({
                    oldValue: newValue,
                    currValue: newValue,
                }, () => {
                    if (onChange) onChange(newValue);
                    if (onReturnPressed) onReturnPressed(newValue);
                });
            }
        } else if (event.key.toLowerCase() === "escape" || event.code.toLowerCase() === "escape") {
            // Just reset the textinput's value to the old value
            this.setState({
                currValue: this.state.oldValue,
            });
        }
    }

    /**
     * This is run after every time the render() method is run to check whether
     * new props have been given.
     */
    componentDidUpdate(prevProps:labeled_text_input_props, prevState:labeled_text_input_state) {
        // Only if props value changed to a different string value should the current value
        // be updated
        if (prevProps.value !== this.props.value && this.props.value !== undefined) {
            this.setState({
                currValue: this.props.value,
            });
        }
    }

    render() {
        return (
            <div className="LabeledTextInput">
                { this.props.labelValue ? <label>{this.props.labelValue}</label> : null }
                <input
                    type="text"
                    value={this.state.currValue}
                    onKeyDown={this.onTextInputKeyDown}
                    onChange={this.onTextInputChange}
                />

            </div>
        );
    }
}