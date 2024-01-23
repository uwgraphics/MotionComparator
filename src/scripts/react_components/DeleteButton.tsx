import React from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faTrashAlt } from '@fortawesome/free-solid-svg-icons';

export interface delete_button_props {
    className?: string,
    onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void,
    style?: React.CSSProperties | undefined,
    id?: string,
}

interface delete_button_state {
}


export class DeleteButton extends React.Component<delete_button_props,delete_button_state> {
  protected _button: React.RefObject<HTMLButtonElement>;

  constructor(props: delete_button_props) {
    super(props);

    this._button = React.createRef();
  }

  render() {
    return (
      <button
        className="DeleteButton"
        ref={this._button}
        onClick={this.props.onClick}
        style={this.props.style}
        id={this.props.id}
      >
        <FontAwesomeIcon className="TrashIcon" icon={faTrashAlt} />
      </button>
    );
  }
}