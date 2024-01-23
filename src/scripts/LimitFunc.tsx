

/**
 * Binds a function so that it can only be called so many times a second i.e.
 * you can call the "call" method on this BoundFunc as many times as you want a
 * second, but it will only actually call its inner functions at most "maxFPS"
 * times a second.
 * 
 * Note: If you call "call", the inner functions are gauranteed to be called in
 * the future (as soon as it can be called and still conform to the maxFPS). The
 * calls are not queued so if the maxFPS is 1 and you call "call" 60 times in a single
 * second, the LimitFunc is not going to call its inner function 60 times. It will only
 * call its inner function once.
 */
export class LimitFunc {
    protected _renderFunc?: () => void;    // Function to call to call all the bound functions
    protected _lastTimeRendered:number;    // The last time the scene was rendered (used by renderLoop)
    protected _maxFPS: number;             // The max FPS that the scene should render at

    protected _renderFuncs: (() => void)[];  // The functions to run to render things, they are passed the amount of time that has passed (in milliseconds) since the last time they were run

    constructor(maxFPS:number=30, boundFuncs?:(() => void)[]) {
        this._lastTimeRendered = 0;
        this._maxFPS = maxFPS;

        this._renderFuncs = boundFuncs ?? [];
    }

    addBoundFunc = (func: () => void) => {
        this._renderFuncs.push(func);
    }

    removeBoundFunc = (func: () => void) => {
        let i = this._renderFuncs.indexOf(func);
        if (i > -1) {
            this._renderFuncs.splice(i, 1);
        }
    }

    maxFPS():number {
        return this._maxFPS;
    }

    setMaxFPS(maxFPS:number) {
        this._maxFPS = maxFPS;
    }

    /**
     * Calls the inner function either immediately or after enough time for
     * maxFPS to be conformed to.
     */
    call = () => {
        if (this._renderFunc !== undefined) {
            return; // renderFunc already in place so don't need to do another one
        }

        this._renderFunc = this.renderFunc;
        requestAnimationFrame(() => {this.renderFunc()});
    }

    /**
     * Force the inner function to be called, even if it does not
     * conform to maxFPS.
     */
    forceCall = () => {
        this.renderFunc(true);
    }

    protected renderFunc = (force?:boolean) => {
        let currTime = Date.now(); // current time in milliseconds
        let timePassed = currTime - this._lastTimeRendered; // time passed in milliseconds

        if (force || timePassed >= (1000 / this._maxFPS)) {
            // enough time has passed so run the animation functions

            for (const func of this._renderFuncs) {
                func();
            }      

            this._lastTimeRendered = currTime;

            this._renderFunc = undefined;
            return;
        }

        // Request again in future because could not render this time
        requestAnimationFrame(() => {this.renderFunc()});
    }
}