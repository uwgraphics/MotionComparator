/**
 * Module for global constants used throughout the app.
 */

import { AssertionError } from "assert";
import { AnimationTable } from "./AnimationTable";
import App from "./react_components/App";
import { PopupHelpPage, PopupHelpPageParams } from "./react_components/popup_help_page";

let _debug: boolean = true;
export function DEBUG(): boolean { return _debug; }
export function setDEBUG(debug: boolean) { _debug = debug }

/// Maximum frames per second.
export const MAX_FRAMERATE = 60;

/**
 * Used by the ThreeScene to never run two functions with the same role.
 */
export class FUNC_ROLE {
    static INIT = "INIT";           // Function initializing the ThreeScene with lights, background color, etc.
    static VIEW_LOAD = "VIEW_LOAD"; // Function loading in a Json scene right before view page is loaded
}


/** 
 * Enum to define what Pages of the app there are.
 */
export class PAGE_NAME {
    static BUILD_PAGE = "BUILD_PAGE";
    static VIEW_PAGE  = "VIEW_PAGE";
}


/**
 * Class used by classes that import App so that there is no cyclical import
 * error.
 */
class AppProxy {
    protected _app?: App; // Will be the App object when it exists

    setApp(app:App) {
        this._app = app;
    }

    app(): undefined | App {
        return this._app;
    }

    /**
     * @returns The current help popup page.
     */
    popupHelpPage(): PopupHelpPageParams {
        if (this._app) {
            return this._app.popupHelpPage();
        } else {
            return { page: PopupHelpPage.None };
        }
    }

    /**
     * Sets the current popup help page.
     * @param page The page to have popup.
     */
    setPopupHelpPage(page: PopupHelpPage | PopupHelpPageParams) {
        if (this._app) {
            this._app.setPopupHelpPage(page);
        } else {
            console.error(`Could not set the current popup page to "${page}" because \`AppProxy._app\` is undefined.`);
        }
    }

    /**
     * Reports a message to the user.
     * @param message The message to report.
     */
    warn(message:string) {
        if (this._app) {
            this._app.warn(message);
        } else {
            console.warn(message);
        }
    }

    /**
     * Asserts that the given condition is true and throws an AssertionError
     * with the given message if it is false.
     * @param cond The condition to assert is true.
     * @param message The message if the assertion is false.
     */
    assert(cond: boolean, message: string) {
        if (cond === false) {
            APP.error(message);
            throw new AssertionError({ message });
        }
    }

    /**
     * Reports an error to the user.
     * @param message The message to be reported.
     */
    error(message:string) {
        if (this._app) {
            this._app.error(message);
        } else {
            console.error(message);
        }
    }

    recalculateTimeWarping() {
        if (this._app !== undefined) {
            this._app.recalculateTimeWarping();
        }
    }

    updateUI() {
        if (this._app !== undefined) {
            this._app.updateUI();
        }
    }

    disallowUpdateUI() {
        if (this._app !== undefined) {
            this._app.disallowUpdateUI();
        }
    }

    allowUpdateUI() {
        if (this._app !== undefined) {
            this._app.allowUpdateUI();
        }
    }

    render() {
        if (this._app !== undefined) {
            this._app.renderScenes();
        }
    }

    addAnimationTable(at:AnimationTable) {
        if (this._app !== undefined) {
            this._app.robotSceneManager().addAnimationTable(at);
        }
    }

    removeAnimationTable(at:AnimationTable) {
        if (this._app !== undefined) {
            this._app.robotSceneManager().removeAnimationTable(at);
        }
    }
}

export const APP: AppProxy = new AppProxy();

export type ModalPlacements = "bigModal" | "hugeModal";


