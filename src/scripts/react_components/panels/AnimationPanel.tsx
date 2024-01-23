import { ModalPlacements } from '../../constants'
import { Component, ReactElement, MouseEvent } from "react";
import { RobotSceneManager } from "../../RobotSceneManager";
import { RobotScene, TimeWarpObj } from "../../scene/RobotScene";
import { panel_props } from "./panel";
import { TimeBar} from '../TimeBar';
import { ColoredTimeBar} from '../ColoredTimeBar';
import { DoubleTimeBar } from '../DoubleTimeBar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVideo, faPlay, faStop, faPause, faRotateRight } from '@fortawesome/free-solid-svg-icons';

type TimeBarChoice = "default" | "colored" | "double";

export interface animation_panel_props extends panel_props {
    changeSceneModalPlacement?: ModalPlacements,
    className?: string,
    allowChangeScene?: boolean,
    robotSceneManager: RobotSceneManager,
    robotScene: RobotScene, // If not given, then the Edit Animations button will not be available
    event_x?: number,
    currTimeBar_prop?: TimeBarChoice
    global?: boolean, // whether it is the global time bar or not
    targetSceneId?: string // the current time warped scene id, valid only when the current time bar is double
}

interface animiation_panel_state {
    currTimeBar: TimeBarChoice,
    event_x: number, // record the x value of the mouse moving event to pass it to Timebar
    start: boolean, // whether to start playing animation or not, the default setting is false
}

export class AnimationPanel extends Component<animation_panel_props, animiation_panel_state> {
    constructor(props:animation_panel_props) {
        super(props);

        this.state = {
            currTimeBar: (this.props.currTimeBar_prop === undefined) ? "default" : this.props.currTimeBar_prop,
            event_x: 0,
            start: false,
        }
    }
    
    onStart = () => {
        this.props.robotSceneManager.startAnimations();
        this.setState({
            start: !this.state.start
        });
    }

    onPause = () => {
        this.props.robotSceneManager.pauseAnimations();
        this.setState({
            start: !this.state.start
        });
    }

    onRestart = () => {
        this.props.robotSceneManager.restartAnimations();
    }

    onCurrTimeChange = (newValue:number) => {
        this.props.robotSceneManager.setCurrTime(newValue);
    }
    onStartTimeChange = (newValue:number) => {
        this.props.robotSceneManager.setCurrStartTime(newValue);
    }
    onEndTimeChange = (newValue:number) => {
        this.props.robotSceneManager.setCurrEndTime(newValue);
    }

    defaultTimeBar = (robotSceneManager: RobotSceneManager, key?: string): ReactElement<any, any> => {
        let [start, currStart, currTime, currEnd, end] = robotSceneManager.timeRange();
        return <TimeBar
            key={key}
            absStartTime={start}
            currStartTime={currStart}
            currTime={currTime}
            currEndTime={currEnd}
            absEndTime={end}
            step={0.001}
            width={400}
            onChange={this.onCurrTimeChange}
            onStartChange={this.onStartTimeChange}
            onEndChange={this.onEndTimeChange}
            event_x={this.state.event_x}
        />;
    }

    coloredTimeBar = (robotSceneManager: RobotSceneManager, twm: readonly[readonly number[], readonly number[]], key?:string): ReactElement<any, any> => {
        let [start, currStart, currTime, currEnd, end] = robotSceneManager.timeRange();
        const colorLevel = this.getColorLevel(twm);
        //getcolor level
        return <ColoredTimeBar
            value={currTime}
            absStart={start}
            absEnd={end}
            start={currStart}
            end={currEnd}
            step={0.001}
            width={400}
            color_level = {colorLevel}
            onChange={this.onCurrTimeChange}
            onStartChange={this.onStartTimeChange}
            onEndChange={this.onEndTimeChange}
        />;
    }
    
    getColorLevel(map: readonly[readonly number[], readonly number[]]){
        /**
         * for i in map:
         *  j = i+1
         *  count = 1
         *  while i.base == j.base: count ++ j++
         *  if count > 1: colorLevel[i.base] = -1 * count  i = j+1
         *  else: while i.scene == j.scene: count ++
         *   colorLevel[i.base] = count
         *  each [a, b] => a is base time, b is warped scene time
         *  [[1, 1], [1, 2], [1, 3],[ 2, 3], [4, 5]]
         */
        // console.log(this.props.robotScene);
        // let map = this.props.robotScene.timeWarping()?.timeWarpMap();
        if(!map){
            // console.log("no timewarp map");
            // this.setState({
            //     colorLevel: []
            // });
            return [];
        }
        // console.log(map);
        // let map:number[][] = [[0,0], [1, 1], [1, 2], [3, 3], [4, 5], [5, 5],[6, 5]]; //TODO fetch map
        // newTimes = [[0, 1, 1, 3, 4, 5, 6]]; 
        // newVals = [[0, 1, 2, 3, 5, 5, 5]];
        let i = 0;
        let j;
        let colorLevel:number[][] = [];
        colorLevel[0] = []; //timestamps in base
        colorLevel[1] = []; //level in warped scene
        while (i < map[0].length){
            j = i + 1;
            let count = 0;
            // if warped scene is fast forwarded => base scene time unchanged, warped scene time increased
            while (j < map[0].length && map[0][i] === map[0][j]){
                count = (map[1][j] - map[1][i]);
                j += 1;
            }
            count /= (j < map[1].length) ? (map[1][j] - map[1][i]) : 1;
            if(count > 0){
                while(i < j){
                    colorLevel[0].push(map[0][i]);
                    colorLevel[1].push(count);
                    i++;
                }
                continue;
            }
            
            // if warped time is slowed down => base scene time increased, warped scene time unchanged
            while(j < map[1].length && map[1][i] === map[1][j]){
                count = map[0][j] - map[0][i];
                j += 1;
            }
            count /= (j < map[0].length) ? (map[0][j] - map[0][i]) : 1;
            if(count > 0){
                while(i < j){
                    colorLevel[0].push(map[0][i]);
                    colorLevel[1].push(-1 * count);
                    i++;
                }
                continue;
            }

            // warped time and base time unchanged
            colorLevel[0].push(map[0][i]);
            colorLevel[1].push(0);
            i++;
        }

        // for each point, take the average of its five neighbors
        // filter the array so that it can have gradual changes
        let filteredLevel = [];
        for(let i=0; i<colorLevel[1].length; i++){
            let sum = colorLevel[1][i];
            let c = 1;
            if(i+1 < filteredLevel.length) {sum += colorLevel[1][i+1]; c++}
            if(i+2 < filteredLevel.length) {sum += colorLevel[1][i+2]; c++}
            if(i-1 >= 0) {sum += colorLevel[1][i-1]; c++}
            if(i-2 >= 0) {sum += colorLevel[1][i-2]; c++}
            filteredLevel.push(sum / c);
        }
        colorLevel[1] = filteredLevel;
        console.log(filteredLevel);
        return colorLevel;
    }

    componentDidUpdate(prevProps:animation_panel_props, prevState:animiation_panel_state) {

        // react to the mouse move in the animation panel
        const {event_x} = this.props; 
        if(prevProps.event_x !== event_x && event_x !== undefined)
        {
            this.setState({
                event_x: event_x
            })
        }
    }

    displayPlayButton()
    {
        const{robotSceneManager} = this.props;
        const {start} = this.state;
        let content: ReactElement;
        if(!start)
        {
            content = (
                <button className="Button" value="Start" onClick={this.onStart}>
                    <FontAwesomeIcon className="Icon" icon={faPlay} />
                </button>
            );
        }
        else
        {
            content = (
                <button className="Button" value="Stop" onClick={this.onPause}>
                    <FontAwesomeIcon className="Icon" icon={faPause} />
                </button>
            );
        }
        return content;
    }
    render() {
        const {robotSceneManager, targetSceneId} = this.props;
        if(robotSceneManager.currEndTime() == robotSceneManager.currTime() && this.state.start === true)
        {
            this.setState({
                start: false
            });
        }
        // let timeWarpBase = robotSceneManager.currTimeWarpBase();
        // let timeWarpBase: RobotScene | undefined;
        // if(baseSceneId !== undefined)
        //     timeWarpBase= robotSceneManager.robotSceneById(baseSceneId);
        // let timeWarpBase = robotSceneManager.currTimeWarpBase();
        let timeWarpBase: RobotScene | undefined;
        let targetScene: RobotScene | undefined = (targetSceneId === undefined) ? undefined : robotSceneManager.robotSceneById(targetSceneId);
        timeWarpBase = targetScene?.currTimeWarpBase();
        let timeBars: ReactElement<any, any>[] = [];
        let timeBarChoice: undefined | ReactElement<any, any>;
        if (timeWarpBase === undefined) {
            // No timewarping, just use the default time bar
            timeBars.push(this.defaultTimeBar(robotSceneManager, "DefaultTimeBar"));
        }  else {
            // There is now a choice, the current state matters

            let timeBarChoices: ReactElement<any, any>[] = [];
            timeBarChoices.push(<option key={"default"} value={"default"} >Default</option>);
            // if (this.state.colorLevel.length > 0) {
            //     timeBarChoices.push(<option key={"colored"} value={"colored"} >Colored</option>);
            // }

            let timeBarMaps = this.props.robotSceneManager.allManagedRobotScenes()
                    .filter((r) => r.id().value() == targetSceneId)
                    .map((r) => [r, r.timeWarping()])
                    .filter(([r, t]) => r !== timeWarpBase && t !== undefined)
                    .map(([r, t]) => [r, t, (t as TimeWarpObj).timeWarp.bind(t), (t as TimeWarpObj).untimeWarp.bind(t), (t as TimeWarpObj).timeWarpMap()])
                    .filter(([,,,, twm]) => twm !== undefined) as any as [RobotScene, TimeWarpObj, (_:number) => number, (_:number) => number, readonly [readonly number[], readonly number[]]][];

            if (timeBarMaps.length > 0) {
                timeBarChoices.push(<option key={"colored"} value={"colored"} >Colored</option>);
                timeBarChoices.push(<option key={"double"} value={"double"} >Double</option>);
            }

            if (timeBarChoices.length > 1) {
                // Allow the current time bar to be chosen
                timeBarChoice =
                    <select name="TimeBarSelector"
                        value={this.state.currTimeBar}
                        onChange={(event) => {
                            let selected = event.target.selectedOptions[0];
                            let id: TimeBarChoice = "default";
                            if (selected !== undefined) {
                                id = selected.value as TimeBarChoice;
                            }
                            this.setState({ currTimeBar: id });
                        }}
                    >
                        {timeBarChoices}
                    </select>
            }

            if (this.state.currTimeBar === "colored") {
                for (const [r,,,, twm] of timeBarMaps) {
                    timeBars.push(this.coloredTimeBar(robotSceneManager, twm, "ColoredTimeBar"+ r.id().value()));
                }
                
            } else if (this.state.currTimeBar === "double" && timeBarMaps.length > 0) {
                for (const [r,, tw, utw, twm] of timeBarMaps) {
                    timeBars.push(
                        <DoubleTimeBar
                            key={r.id().value()}
                            timeWarpBaseName={timeWarpBase.name()}
                            timeWarpTargetName={r.name()}
                            timeWarp={tw}
                            untimeWarp={utw}
                            timeWarpMap={twm}
                            info={robotSceneManager}
                            event_x={this.props.event_x}
                        />
                    );
                }
            } else {
                timeBars.push(this.defaultTimeBar(robotSceneManager, "DefaultTimeBar"));
            }
        }

        return (
            <div className="AnimationPanel">
                {!this.props.global && timeBarChoice}
                {this.displayPlayButton()}
                <button className="Button" value="Restart" onClick={this.onRestart}> 
                    <FontAwesomeIcon className="Icon" icon={faRotateRight} />
                </button>
                {timeBars}
            </div>
        );
    }
}