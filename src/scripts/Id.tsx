import { newID } from "./helpers";


/**
 * A simple ID object that makes it easy to give objects an ID.
 */
export class Id {
    protected _id:string;

    constructor(id?:string) {
        this._id = id ?? newID(64, 64);
    }

    set(id:string) {
        this._id = id;
    }

    value():string {
        return this._id;
    }

    regen():void {
        this._id = newID(64, 64);
    }
}