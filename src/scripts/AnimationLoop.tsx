import { clamp } from "lodash";
import { APP } from "./constants";
import { LimitFunc } from "./LimitFunc";

/**
 * An object that is meant to help fascilitate animations. You set the amount of
 * time you want it to run for and then start the animation loop. The loop will then
 * call its "render" function a maximum of "maxFPS" times a second until the
 * specified amount of time has passed. After the specified amount of time has
 * passed, the animation loop stops animating (stops calling the render function
 * with the current time).
 */
export class AnimationLoop {
    protected _currTime: number;
    protected _lastTimeRendered: number;
    protected _endTime: number;
    protected _startTime: number;
    protected _maxFPS: number;
    protected _wasPlaying: boolean;
    protected _playFunc?: () => void;
    protected _renderFunc: (currTime:number) => void;

    protected _render: LimitFunc;

    constructor(maxFPS:number, startTime:number, endTime:number, callback: (currtime:number) => void) {
        this._currTime = startTime; // current time in the animation

        this._lastTimeRendered = 0; // never rendered before

        this._startTime = startTime;
        this._endTime = endTime;

        this._maxFPS = maxFPS;

        this._wasPlaying = false;

        this._renderFunc = callback;

        this._render = new LimitFunc(maxFPS, [this.render]);
    }

    startTime():number { return this._startTime; }
    setStartTime(startTime:number) {
        startTime = Math.min(startTime, this._endTime)
        if (startTime !== this._startTime) {
            this._startTime = startTime;
            if (this._currTime < startTime) {
                this._currTime = startTime;
            }
            APP.updateUI();
        }
    }

    endTime():number { return this._endTime; }
    setEndTime(endTime:number) {
        endTime = Math.max(this._startTime, endTime)
        if (endTime !== this._endTime) {
            this._endTime = endTime;
            if (this._currTime > endTime) {
                this._currTime = endTime;
            }
            APP.updateUI();
        }
    }

    maxFPS():number { return this._maxFPS; }
    setMaxFPS(maxFPS:number) {
        this._maxFPS = Math.max(maxFPS , 1);
        this._render.setMaxFPS(maxFPS);
        APP.updateUI();
    }

    /**
     * Returns the current time (in seconds) since this animation loop began.
     * @returns The current time (in seconds) since this animation loop began.
     */
    time = (): number => { return this._currTime; }

    /**
     * Sets the current time (in seconds) since this animation loop began.
     */
    setTime = (newTime: number) => {
        newTime = clamp(newTime, this._startTime, this._endTime);
        if (newTime !== this._currTime) {
            if (this._playFunc === undefined) {
                // The animation is not currently playing, so we need to call the
                // render function manually (because the animation playing will not
                // call it for us)
                this._currTime = newTime;
                this._render.call();
                APP.updateUI();
            } else {
                // Animation is playing so we just need to set the current time and
                // the next scheduled render will render it
                this._currTime = newTime;
            }
        }
    }

    /**
     * Starts the animation loop (if one is not already looping).
     */
    start = () => {
        if (this._playFunc === undefined) {
            this._playFunc = () => {
                let currTime = Date.now();
                let timePassed = Math.abs(currTime - this._lastTimeRendered);

                if (this._wasPlaying === false) {
                    this._wasPlaying = true;
                    this._lastTimeRendered = currTime;
                    if (this._playFunc !== undefined) {
                        requestAnimationFrame(this._playFunc);
                    } else {
                        this.stop();
                    }
                    return;
                }
                
                if (this._playFunc !== undefined) {
                    this._currTime += timePassed / 1000;

                    if ((currTime - this._lastTimeRendered) >= (1000 / (this._maxFPS * 2))) {
                        // Enough time has passed that it is now okay to render

                        this._render.forceCall();
                        this._lastTimeRendered = currTime;
                    }

                    if (this._playFunc !== undefined) {
                        requestAnimationFrame(this._playFunc);
                    }
                }
            }
            requestAnimationFrame(this._playFunc);
        }
    }

    /**
     * Stops the current animation loop.
     */
    stop = () => {
        this._wasPlaying = false;
        this._playFunc = undefined;

    }

    /**
     * Restarts the animation loop (does not stop the loop if currently
     * playing, just sets the current time in the animation to 0).
     */
    restart = () => {
        this.setTime(this._startTime);
    }

    protected render = () => {
        let currTime = this._currTime;

        if (currTime > this._endTime) {
            currTime = this._endTime;
            this._currTime = this._endTime;
            this.stop();
        } else if (currTime < this._startTime) {
            this._currTime = 0;
            currTime = this._startTime;
        }
        this._renderFunc(currTime);
    }
}