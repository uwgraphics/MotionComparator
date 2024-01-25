import { Component } from "react";
import { HexColorPicker, HexColorInput } from "react-colorful";

export interface labeled_color_picker_props {
    color?: string,
    onColorMapChange: (newValue: string) => void,
    forceUpdateTabNames: () => void,
}

interface labeled_color_picker_state {

}

export class ColorPicker extends Component<labeled_color_picker_props, labeled_color_picker_state> {
    render() {
        return (
            <div className="ColorPicker">
                <HexColorPicker
                    color={this.props.color}
                    onChange={(newColor) => this.props.onColorMapChange(newColor)} />
                <div className="ColorInput">
                    <label>Enter color in hex format (e.g., C5050C):</label>
                    <HexColorInput
                        color={this.props.color}
                        onChange={(newColor) =>{
                            this.props.onColorMapChange(newColor);
                            this.props.forceUpdateTabNames(); // trigger rendering so the HexColorPicker is updated instantly
                        }} />
                </div>
            </div>
        );
    }
}