import { Component } from "react";

export interface labeled_check_box_props {
    style?: React.CSSProperties,
    checked?: boolean,
    label: string,
    name?: string,
    labelOnRight?: boolean,
    onChange?: (event:React.ChangeEvent<HTMLInputElement>) => void, // function to call when checkbox changes
}

interface labeled_check_box_state {

}

export class LabeledCheckBox extends Component<labeled_check_box_props, labeled_check_box_state> {
    render() {
        return (
            <div className="LabeledCheckBox" style={this.props.style}>
                {
                    this.props.labelOnRight ? 
                        <>
                            <input type="checkbox" checked={this.props.checked} onChange={this.props.onChange} name={this.props.name ?? ""}/>
                            <label>{this.props.label}</label>
                        </>
                    :
                        <>
                            <label>{this.props.label}</label>
                            <input type="checkbox" checked={this.props.checked} onChange={this.props.onChange} name={this.props.name ?? ""}/>
                        </>
                    
                }
            </div>
        );
    }
}