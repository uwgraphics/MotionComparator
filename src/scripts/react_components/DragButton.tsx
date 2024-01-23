import DockLayout, { DragDropDiv, DragState } from "rc-dock";
import React from "react";

export interface drag_button_props {
    className?: string,
    title?: string,
    onDragStart?: (event: DragState) =>
        undefined // Return undefined if cannot start drag
        | [
            string, // The id of the new tab
           ((event: DragState) => void), // return true if accept the drag and false otherwise
        ],
    onClick?: React.MouseEventHandler<HTMLButtonElement>,
    style?: React.CSSProperties | undefined,
    getParentDockLayout: () => DockLayout | undefined,
    buttonValue: string,
}

interface drag_button_state {
}

let onDropCallback: undefined | ((event: DragState) => void);

export class DragButton extends React.Component<drag_button_props, drag_button_state> {
    protected _button: React.RefObject<HTMLButtonElement>;

    constructor(props:drag_button_props) {
        super(props);

        this._button = React.createRef();
    }

    render() {
        return (
            <DragDropDiv
                className={`DragButton_${this.props.className ? this.props.className : ""}`}
                onDragStartT={(e:DragState) => {
                    let startCallback = this.props.onDragStart;
                    if (!startCallback) {
                        return;
                    }

                    let res = startCallback(e);
                    if (res === undefined) {
                        return;
                    }

                    let [id, _onDropCallback] = res;


                    let button = this._button.current;
                    if (button) {
                        let parentLayout = this.props.getParentDockLayout();
                        if (parentLayout) {
                            onDropCallback = _onDropCallback;
                            e.setData({tab: { id: id }}, parentLayout); // Dragging tab in this particular DockLayout
                            e.startDrag(button, button); // Show button being dragged
                        }
                    }
                }}
                onDragEndT={(e:DragState) => {
                    if (onDropCallback) {
                        onDropCallback(e);
                    }
                }}
            >
                <button
                    className="DragButtonButton"
                    ref={this._button}
                    title={this.props.title}
                    onClickCapture={this.props.onClick}
                    style={this.props.style}
                >
                    {this.props.buttonValue}
                </button>
            </DragDropDiv>
        );
    }
}