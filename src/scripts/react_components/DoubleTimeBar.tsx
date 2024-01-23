import { Component } from "react";
import { TimeBar } from "./TimeBar";
import { RobotSceneManager } from "../RobotSceneManager";
import { binarySearchLowerBound, clamp, lerp, zip } from "../helpers";
import { RobotScene, TimeWarpObj } from "../scene/RobotScene";
import assert from "assert";
import React from "react";

export interface double_time_bar_props {
    timeWarpBaseName: string,
    timeWarpTargetName: string,

    timeWarp: (_:number) => number;
    untimeWarp: (_:number) => number;
    timeWarpMap: readonly [readonly number[], readonly number[]];

    step?:number,

    /// Give RobotSceneManager for default callbacks or implement them yourself.
    info: RobotSceneManager | {
        absStartTime: number,
        currStartTime: number,
        currTime: number,
        currEndTime: number,
        absEndTime: number,

        onBaseCurrStartTimeChange: (newValue:number) => void,
        onBaseCurrTimeChange: (newValue:number) => void,
        onBaseCurrEndTimeChange: (newValue:number) => void,

        onTargetCurrStartTimeChange: (newValue:number) => void,
        onTargetCurrTimeChange: (newValue:number) => void,
        onTargetCurrEndTimeChange: (newValue:number) => void,
    }

    event_x?: number,
}

interface double_time_bar_state {
    timeBarWidth: number, // current timebar width in pixels
}

/**
 * Time warping takes two scenes, a base scene and a target scene, and attempts
 * to make the motion of a Robot in the target scene as close as possible to the motion
 * in the base scene only by speeding up or slowing down the time in one scene or the other.
 * 
 * This time bar provides two sub time bars -- one for the base scene and one
 * for the target scene -- and allows you to scrub in the time scale of either
 * one of them. In addition, it also draws lines between them to show what each
 * time in the base scene corresponds to in the target scene and vice-versa.
 */
export class DoubleTimeBar extends Component<double_time_bar_props, double_time_bar_state> {
    protected _timeBarDiv: React.RefObject<HTMLDivElement>;
    protected _time_bar_resize_observer?: ResizeObserver;

    constructor(props:double_time_bar_props) {
        super(props);

        this._timeBarDiv = React.createRef();

        this.state = {
            timeBarWidth: 400,
        }
    }

    componentDidMount(): void {
        this._time_bar_resize_observer = new ResizeObserver((entries)=>{
            this.setState({
                timeBarWidth: entries[0].contentRect.width
            });
        });
        if(this._timeBarDiv && this._timeBarDiv.current){
            this._time_bar_resize_observer.observe(this._timeBarDiv.current);
        }
    }
    componentWillUnmount() {
        if (this._time_bar_resize_observer) {
          this._time_bar_resize_observer.disconnect();
        }
    }

    //  /**
    //  * This is run after every time the render() method is run to check whether
    //  * new props have been given. If so, then it sets the bar to reflect those
    //  * new props only if the bar is not hovered (i.e. the user is not actively
    //  * changing the value of the inputs).
    //  */
    //  componentDidUpdate(prevProps:double_time_bar_props, prevState:double_time_bar_state) {
    //     // react to the mouse move in the animation panel
    //     const {event_x} = this.props; 
    //     if(prevProps.event_x !== event_x && event_x !== undefined)
    //     {
    //         this.dragfromotherplace(event_x);
    //     }
    //  }

    render() {
        const timeBarStep = this.props.step ?? 0.001;
        const timeBarWidth = this.state.timeBarWidth;
        const timeBarHeight = 30; // Time bar height in pixels

        let timeWarp = this.props.timeWarp;
        let timeWarpMap = this.props.timeWarpMap;
        let untimeWarp = this.props.untimeWarp;

        let absStartTime: number;
        let currStartTime: number;
        let currTime: number;
        let currEndTime: number;
        let absEndTime: number;
        let onBaseCurrStartTimeChange: (_:number) => void;
        let onBaseCurrTimeChange: (_:number) => void;
        let onBaseCurrEndTimeChange: (_:number) => void;
        let onTargetCurrStartTimeChange: (_:number) => void;
        let onTargetCurrTimeChange: (_:number) => void;
        let onTargetCurrEndTimeChange: (_:number) => void;

        if ("onBaseCurrStartTimeChange" in this.props.info) {
            let info = this.props.info;
            absStartTime = info.absStartTime;
            currStartTime = info.currStartTime;
            currTime = info.currTime;
            currEndTime = info.currEndTime;
            absEndTime = info.absEndTime;

            onBaseCurrStartTimeChange = info.onBaseCurrStartTimeChange;
            onBaseCurrTimeChange = info.onBaseCurrTimeChange;
            onBaseCurrEndTimeChange = info.onBaseCurrEndTimeChange;

            onTargetCurrStartTimeChange = info.onTargetCurrStartTimeChange;
            onTargetCurrTimeChange = info.onTargetCurrTimeChange;
            onTargetCurrEndTimeChange = info.onTargetCurrEndTimeChange;
        } else {
            let info = this.props.info;
            [absStartTime, currStartTime, currTime, currEndTime, absEndTime] = info.timeRange();

            onBaseCurrStartTimeChange = ((newValue) => { info.setCurrStartTime(newValue); })
            onBaseCurrTimeChange = ((newValue) => { info.setCurrTime(newValue); })
            onBaseCurrEndTimeChange = ((newValue) => { info.setCurrEndTime(newValue); })

            onTargetCurrStartTimeChange = ((newValue) => { info.setCurrStartTime(untimeWarp(newValue)); })
            onTargetCurrTimeChange = ((newValue) => { info.setCurrTime(untimeWarp(newValue)); })
            onTargetCurrEndTimeChange = ((newValue) => { info.setCurrEndTime(untimeWarp(newValue)); })
        }

        const svgLines: React.ReactElement<any, any>[] = [];
        const totalTime = Math.abs(absEndTime - absStartTime);

        // Generate the svgLines
        const [baseTimes, targetTimes] = timeWarpMap;
        assert(baseTimes.length === targetTimes.length);
        const length = baseTimes.length;

        // Having an eighth the number of lines possible seems about right
        // as having every line possible just fill the entire SVG with
        // lines, making it impossible to see them.
        const inc: number = Math.max(Math.floor(length / (timeBarWidth / 16)), 1);

        let lastLinePushed = false;

        let pushLine = (i: number) => {
            let baseTime = clamp(baseTimes[i], 0, totalTime);
            let targetTime = clamp(targetTimes[i], 0, totalTime);

            const x1 = lerp(0, timeBarWidth, baseTime / totalTime);
            const y1 = 0;
            const x2 = lerp(0, timeBarWidth, targetTime / totalTime)
            const y2 = timeBarHeight;

            svgLines.push(
                <line
                    key={`${x1} ${y1} ${x2} ${y2}`}
                    stroke={"#B18FCF"}
                    x1={`${x1}px`} y1={`${y1}px`}
                    x2={`${x2}px`} y2={`${y2}px`}
                /> 
            );
        }

        // Generate the lines
        for (let i = 0; i < length; i += inc) {
            pushLine(i);

            if (i === length - 1) {
                lastLinePushed = true;
            }
        }

        // Push last line if not already pushed (want to make sure that both
        // the first and last lines are always pushed)
        if (!lastLinePushed && length > 0) {
            pushLine(length - 1);
        }

        let targetSceneName = "";
        let strs = this.props.timeWarpTargetName.split(" ");
        for(const s of strs)
            if(s === "Time")
                break;
            else
                targetSceneName += s + " ";
        return (
            <div className="DoubleTimeBar">
                <div className="topTimeBar">
                    <div>Base:{` ${this.props.timeWarpBaseName}`}</div>
                    <TimeBar
                        absStartTime={absStartTime}
                        currStartTime={currStartTime}
                        currTime={currTime}
                        currEndTime={currEndTime}
                        absEndTime={absEndTime}

                        step={timeBarStep}

                        width={timeBarWidth}

                        onStartChange={onBaseCurrStartTimeChange}
                        onChange={onBaseCurrTimeChange}
                        onEndChange={onBaseCurrEndTimeChange}
                        event_x={this.props.event_x}
                    />
                </div>
                <div className="middleSVG" style={{"height": `${timeBarHeight}px`}}>
                    <div className='inputDiv' style={{"height": `${timeBarHeight}px`}} >
                        <input type="text" style={{visibility:"hidden"}} />
                        <input type="text" style={{visibility:"hidden"}} />
                    </div>
                    <div className="svgDiv" ref={this._timeBarDiv} style={{"height": `${timeBarHeight}px`, "paddingLeft": "10px", "paddingRight": "10px"}} >
                        <svg width={timeBarWidth} height={`${timeBarHeight}px`} style={{ "height": `${timeBarHeight}px`, "width": `${this.state.timeBarWidth}px`}}>
                            {/* Create the background. */}
                            <rect
                                fill={'rgb(23, 24, 25)'} 
                                x={0} 
                                y={0} 
                                width={`${timeBarWidth}px`} 
                                height={`${timeBarHeight}px`} 
                            />
                            {/* Create the lines on top of the background. */}
                            {svgLines}
                        </svg>
                    </div>
                    <div className='inputDiv' style={{"height": `${timeBarHeight}px`}} >
                        <input type="text" style={{visibility:"hidden"}} />
                    </div>
                </div>
                <div className="bottomTimeBar">
                    <TimeBar
                        absStartTime={absStartTime}
                        currStartTime={timeWarp(currStartTime)}
                        currTime={timeWarp(currTime)}
                        currEndTime={timeWarp(currEndTime)}
                        absEndTime={absEndTime}

                        step={timeBarStep}

                        width={timeBarWidth}

                        onStartChange={onTargetCurrStartTimeChange}
                        onChange={onTargetCurrTimeChange}
                        onEndChange={onTargetCurrEndTimeChange}
                        event_x={this.props.event_x}
                    />
                    <div>Target:{` ${targetSceneName}`}</div>
                </div>
            </div>
        );
    }
}