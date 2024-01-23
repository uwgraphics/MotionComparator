import React from "react";

export interface click_button_props {
    className?: string,
    onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void,
    style?: React.CSSProperties | undefined,
    buttonValue: string,
}

interface click_button_state {
}


export class ClickButton extends React.Component<click_button_props, click_button_state> {
    protected _button: React.RefObject<HTMLButtonElement>;

    constructor(props:click_button_props) {
        super(props);

        this._button = React.createRef();
    }

    render() {
        return (
            <button
                className="ClickButton"
                ref={this._button}
                onClick={this.props.onClick}
                style={this.props.style}
                >
                {this.props.buttonValue}
            </button>
        );
    }
}