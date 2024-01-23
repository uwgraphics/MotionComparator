import { Component } from 'react';
import "rc-dock/dist/rc-dock-dark.css";
import '../../styles/index.scss';
import { APP, PAGE_NAME } from '../constants';
import { RobotSceneManager } from '../RobotSceneManager';
import { AnimationTable } from '../AnimationTable';
import { RobotWorkspace } from './RobotWorkspace';
import React from 'react';
import { PopupHelpPage, PopupHelpPageParams, popupHelpPageDiv } from './popup_help_page';

interface app_props { }

interface app_state {
    /** The current page of the application. */
    currPageName: PAGE_NAME,
    /** The manager that manages all robots, their scenes, and their animations. */
    robotSceneManager: RobotSceneManager, // current RobotScene
    /** The URL of the .json session to load on startup (if there is one to load.) */
    jsonURL: string | undefined,

    /** A counter that simply increments every time the UI should update but would not otherwise do so. */
    uiUpdateCnt:number, // used to make sure that the UI updates
    /** The previous start and end times. */
    prev_times: { startTime: number, endTime: number, },

    /** The current popup page to be shown. */
    currPopupHelpPage: PopupHelpPageParams,
}

/**
 * The root of the Application.
 */
export default class App extends Component<app_props, app_state> {
    protected _disallowUpdateUI: number;
    protected _workspaceRef: React.RefObject<RobotWorkspace>;

    constructor(props:app_props={}) {
        super(props);

        // Bind methods so that  the variable `this` is always defined as this
        // object in them -- even when they are used as a callback elsewhere
        this.goToPage = this.goToPage.bind(this);
        this.currPage = this.currPage.bind(this);
        this.href     = this.href.bind(this);
        this.updateUI = this.updateUI.bind(this);
        this.error    = this.error.bind(this);

        this._disallowUpdateUI = 0;

        let sceneManager = new RobotSceneManager();

        // Check what the current page should be
        let currPageName: string;
        let jsonURL: string | undefined;
        let href = this.href();
        let parts = href.split('?');
        if (parts.length === 1) {
            currPageName = PAGE_NAME.BUILD_PAGE;
        } else if (parts.length === 2) {
            currPageName = PAGE_NAME.BUILD_PAGE;

            // Assume that all the text after the '?' is a link to a serialized
            // RobotScene so deserialize it and go to the ViewPage to view the
            // result
            let linkToSerial = parts[1];

            jsonURL = linkToSerial;
        } else {
            currPageName = PAGE_NAME.BUILD_PAGE;
            this.warn(`More than one question mark "?" in this page's URL. Did you mean to go to the view/playback page instead? If so, include only 1 question mark at the end of the website's url and put the url to the json of the scene you want to go to after it.`);
        }

        // define state
        this.state = {
            currPageName: currPageName,
            robotSceneManager: sceneManager,
            jsonURL: jsonURL,
            uiUpdateCnt: 0,
            currPopupHelpPage: { page: PopupHelpPage.None },
            prev_times : {
                startTime: sceneManager.startTime(),
                endTime: sceneManager.endTime(),
            }
        }

        this._workspaceRef = React.createRef();
    }

    recalculateTimeWarping() {
        for(const robotScene of this.state.robotSceneManager.allManagedRobotScenes())
        {
            if(robotScene.isTimeWarping())
            {
                let baseScene = robotScene.currTimeWarpBase();
                robotScene.setTimeWarpBase(undefined);
                robotScene.setTimeWarpBase(baseScene);
            }
        }
        // original code
        // let base = this.state.robotSceneManager.currTimeWarpBase();
        // this.state.robotSceneManager.setTimeWarpBase(undefined);
        // this.state.robotSceneManager.setTimeWarpBase(base);
    }

    robotSceneManager():RobotSceneManager {
        return this.state.robotSceneManager;
    }

    addAnimationTable(at:AnimationTable) {
        this.state.robotSceneManager.addAnimationTable(at);
    }

    removeAnimationTable(at:AnimationTable) {
        this.state.robotSceneManager.removeAnimationTable(at);
    }

    renderScenes() {
        this.state.robotSceneManager.currRobotScene()?.render();
    }

    href():string {
        return window.location.href;
    }

    /**
     * Goes to the given page of the application.
     * @param currPageName The name of the page you want to go to.
     */
    goToPage(currPageName:PAGE_NAME) {
        this.setState({ currPageName: currPageName });
    }

    currPage(): PAGE_NAME {
        return this.state.currPageName;
    }

    /**
     * Reports the given error message to the user.
     * @param message The message to report.
     */
    error(message:string) {
        console.error(message); // for now, just log the error
    }

    /**
     * Reports a warning to the user.
     * @param message The message to report.
     */
    warn(message:string) {
        console.warn(message); // For now, just log it
    }

    /**
     * @returns The current popup page shown.
     */
    popupHelpPage(): PopupHelpPageParams {
        return this.state.currPopupHelpPage;
    }

    /**
     * Sets the current popup help page.
     * @param page The enum variant of the page you want to popup.
     */
    setPopupHelpPage(page: PopupHelpPage | PopupHelpPageParams) {
        let params = (typeof page === "string" ? { page } : page);
        this.setState({ currPopupHelpPage: params })
    }

    /**
     * Callback to make sure that the entire UI updates. This is necessary because
     * props are supposed to be immutable (you are supposed to need to call
     * setState in a callback every time you change one of them) but some props
     * this app uses (namely, the RobotScene objects) are mutable and thus are
     * changed without calling setState. This is a problem because calling setState
     * is what makes React check whether the UI needs to be updated. This method
     * is a workaround to call whenever you make a change to such mutable objects
     * so that the entire UI checks for updates when you do.
     * 
     * Note: calling setState is preferable to calling forceUpdate here because
     * the state is updated at specific times, coalescing multiple new States
     * into 1 at that time. forceUpdate, however, will make it update
     * immediately every single time this method is called, which may be a
     * problem if a billion calls to updateUI are done per second. setState
     * puts a limit on how often the update is actually done, so calling this
     * method a billion times is not a problem as it will still only update the
     * UI a handful of times per second.
     * 
     * Note 2: the counter is necessary because, to my knowledge, React does
     * a check to see if the new state is actually different from the old one
     * before checking for changes to the virtual DOM, so the counter makes
     * sure that that is always true.
     */
    updateUI() {
        if (this._disallowUpdateUI <= 0) {
            this.setState({ uiUpdateCnt: (this.state.uiUpdateCnt + 1) % 1000000000 });
        }

        if (this._disallowUpdateUI < 0) {
            console.warn("disallowUpdateUI is less than 0!");
        }
    }

    allowUpdateUI() {
        this._disallowUpdateUI += 1;
    }

    disallowUpdateUI() {
        this._disallowUpdateUI -= 1;
    }

    componentDidMount() {
        //assert(APP.app() === undefined, "APP.app() was not undefined! Only 1 APP may be running at a time.")
        APP.setApp(this); // Only 1 App object can be mounted at a time so this should be fine

        if (this.state.jsonURL) {
            // Must be on the view page so load the URL into the scene automatically now that
            // this App has mounted ont the DOM
            let jsonURL = this.state.jsonURL;

            // Since a method with the same `role` will not be run twice for the
            // same RobotScene, and the role is determined by string, this should
            // make sure that the same jsonURL is never loaded twice
            this.state.robotSceneManager.currRobotScene()?.runOnce(`Load:${jsonURL}`, () => {
                this.state.robotSceneManager.loadSessionFromURL(jsonURL, this._workspaceRef.current?.onRestoreLayout);
            });
        }
    }

    componentDidUpdate() {
        let { startTime, endTime } = this.state.prev_times;
        let sceneManager = this.state.robotSceneManager;
        let [newStartTime, newEndTime] = [sceneManager.startTime(), sceneManager.endTime()];
        if (startTime !== newStartTime || endTime !== newEndTime) {
            this.recalculateTimeWarping();
            this.setState({ prev_times: { startTime: newStartTime, endTime: newEndTime } });
        }
    }

    render() {
        return (
            <div className="App">
                <div className="BuildPage">
                    <RobotWorkspace ref={this._workspaceRef} robotSceneManager={this.state.robotSceneManager} />
                </div>
                {popupHelpPageDiv(this.state.currPopupHelpPage)}
            </div>
        );
    }
}
