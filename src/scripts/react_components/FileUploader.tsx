import React, { Component } from "react";

export interface file_uploader_props {
    label?:string, // an optional label for the uploader
    accept?:string | string[], // What types of files to allow
    includeDirs?: boolean, // whether to allow a directory to be selected
    vertical?: boolean, // if true, puts the label on the line above the browse button, otherwise the label is to the left of the browse button. Has no effect if there is no label given
    onChange?: (event:React.FormEvent<HTMLInputElement>) => void, // function to call when selected file changes
}

interface file_uploader_state {
}

export class FileUploader extends Component<file_uploader_props, file_uploader_state> {
    render() {
        let acceptTypes:string;
        if (typeof this.props.accept === "string") {
            acceptTypes = this.props.accept;
        } else if (Array.isArray(this.props.accept)) {
            acceptTypes = this.props.accept.join(', ');
        } else {
            acceptTypes = "*"; // Accept any file
        }

        return (
            <div className="FileUploader">
                {this.props.label ? <label>{this.props.label}</label> : undefined}
                {this.props.label && this.props.vertical ? <br/> : undefined}
                <label className="fileInputHolder">
                    <input type="file" accept={acceptTypes} onChange={this.props.onChange} {...(this.props.includeDirs ? {webkitdirectory:""} : {})} />
                    Browse Files
                </label>
            </div>
        );
    }
}