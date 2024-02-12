import { Component, createRef } from "react";
import * as d3 from 'd3'; 
import { genSafeLogger } from "../helpers";
import _ from 'lodash';

interface line_graph_props {
    times: number[][],
    vals: number[][]
    startTime: number,
    endTime: number,
    currTime: number,
    isZoom: boolean,// true only in zoomed graphs to determine location of timebar shade
    isDiff: boolean,// true only in difference graphs
    isTimeWarp: boolean, //true only in time warp graphs
    line_names: string[], //list of names of lines graphed
    line_ids: string[], //list of ids of lines graphed
    prev_map: Map<string, number>, //maps line ids to index in line_names -> only includes lines that needed to be drawn
    line_colors: string[], //list of colors of lines graphed
    title: string, // the title of the graph
    selected?: boolean // whether the current tab is selected or not
    width: number, 
    height: number,
    lineWidth: number,
    axisColor: string,
    onGraphUpdate: (updated:boolean) => boolean,
    onCurrChange: (newValue:number) => void,
    onStartChange: (newValue:number) => void,
    onEndChange: (newValue:number) => void,
    onDeleteChange?: (line: string) => void,
    onSelectLine?: (line: string, index: number) => void,
}
interface data_entry {
    times: number,
    vals: number
}


interface line_graph_state {
    // w: number,
    // h: number,
    prev_x: any,
    prev_y: any,
    margin: margin_obj,
    prev_lines: Map<string, any>, //map line ids to line "object"
    // time_concat: number[],
    time_min: number,
    time_max: number,
    val_concat: number[],
    newCurr: number,

    // //interactive components
    // dragStart: boolean, //dragging the start traveller
    // dragValue: boolean, //dragging the slider
    // dragEnd: boolean, //dragging the end traveller
    mouseXCoord: number //only need x coordinate
    originalMouseXCoord: number
    currDragItem: dragItem;

}
type dragItem = "end"|"start"|"curr"|null;
interface margin_obj{
    top: number,
    right: number, 
    bottom: number, 
    left: number 
}
const log = genSafeLogger(5000);
export class LineGraph extends Component<line_graph_props, line_graph_state> {
    protected _graphDiv: React.RefObject<HTMLDivElement>;
    protected prevTimes: number[][];
    protected prevVals: number[][];
    constructor(props:line_graph_props){
        super(props);
        this._graphDiv = createRef();
        this.drawGraph.bind(this);
        this.state = {
            // w: width,//+300,//1015,
            // h: height,//600,
            prev_x: null,
            prev_y: null,
            margin: {
                top: 20,
                right: 10, 
                bottom: 40, 
                left: 60, // should be careful with this value as it can mess up the value along y axis
            },
            prev_lines: new Map<string, any>(),
            // time_concat: [],
            time_min: -999,
            time_max: -999,
            val_concat: [],
            newCurr: this.props.currTime,
            mouseXCoord: -1,
            originalMouseXCoord: -1,
            currDragItem: null
        };
        this.prevTimes = this.props.times;
        this.prevVals = this.props.vals;
    }
    componentDidMount(): void {
        if(this._graphDiv.current && this._graphDiv.current.children.length > 0){
            this._graphDiv.current.removeChild(this._graphDiv.current.children[0]);
        }
        // const {w, h} = this.state;
        let {height, width} = this.props;
        width = width - 20;
        height = height - 20;
        let svg = this.drawGraph(true, true);
        if(svg){
            d3.select(this._graphDiv.current)
                .append("svg")
                .attr("width", width)
                .attr("height", height)
                .node().appendChild(svg);
        }
        
    }
    componentDidUpdate(prevProps:line_graph_props) {
        const boundChangeInZoom = /*this.props.isZoom && */(prevProps.startTime !== this.props.startTime || prevProps.endTime !== this.props.endTime);
        const lineWidthChange = prevProps.lineWidth !== this.props.lineWidth;
        const axisColorChange = prevProps.axisColor !== this.props.axisColor;
        let colorChange = !_.isEqual(new Set(prevProps.line_colors), new Set(this.props.line_colors)) && prevProps.line_colors.length === this.props.line_colors.length;
        let windowChanged = prevProps.height !== this.props.height || prevProps.width !== this.props.width;
        // if(this.state.newCurr !== this.props.currTime){
        //     log(" in component did update and newCurr is different from original!")
        //     this.props.onCurrChange(this.state.newCurr);
        // }
        if (prevProps.times !== this.props.times || 
            prevProps.vals !== this.props.vals ||
            windowChanged ||colorChange ||
            boundChangeInZoom || lineWidthChange || axisColorChange) {
            // log("is here in line graph componentdidupdate");
            // log(prevProps.times !== this.props.times)
            // log(prevProps.vals !== this.props.vals)
            // log(windowChanged)
            // log(colorChange )
            // log(boundChangeInZoom)
            // log("end")
            if(this._graphDiv.current && this._graphDiv.current.children.length > 0){
                this._graphDiv.current.removeChild(this._graphDiv.current.children[0]);
            }
            // const {w, h} = this.state;
            let {width, height} = this.props;
            width = width - 20;
            height = height - 20;
            let svg = this.drawGraph(boundChangeInZoom, colorChange, windowChanged, lineWidthChange);
            // log(svg);
            // console.log("width " + w + " height " + h);
            if(svg){
                d3.select(this._graphDiv.current)
                    .append("svg")
                    .attr("width", width)
                    .attr("height", height)
                    .node().appendChild(svg);
            }
            
            // this.drawGraph();
        }
        
    }

    /**
     * filter the data based on the current start time and end time
     * @param startTime 
     * @param endTime 
     * @returns 
     */
    filterData(startTime: number, endTime: number): [number[][], number[][]]
    {
        let zoomedTimes: number[][] = [], zoomedValues: number[][] = [];
        const {times, vals} = this.props;
        if(times.length === 0 || vals.length === 0) return [[[0, 8]], [[0, 8]]];
        let startIndex = 0, endIndex = times[0].length-1;
        for(let i=0; i<times[0].length; i++)
        {
            if(times[0][i] >= startTime)
            {
                startIndex = i;
                break;
            }
        }
        for(let i=times[0].length-1; i>=0; i--)
        {
            if(times[0][i] <= endTime)
            {
                endIndex = i;
                break;
            }
        }
        
        for (let i = 0; i < times.length; i++) {
            let index = 0;
            zoomedTimes[i] = [];
            zoomedValues[i] = [];
            for (let j = startIndex; j < endIndex; j++) {
                
                zoomedTimes[i][index] = times[i][j];
                zoomedValues[i][index] = vals[i][j];
                index++;
            }
        }
        // console.log(vals);
        return [zoomedTimes, zoomedValues]
    }
    /**
     * 
     * @param a times array
     * @param b values array
     * @returns list of data entry to plug into d3 graph
     */
    static parseData(a:number[], b:number[]):data_entry[]{
        if(a == undefined || b == undefined)
        {
            log("ERROR: undefined arrays!")
            return [];
        }
        if(a.length !== b.length){
            log("ERROR: parseData param arrays length discrepancy")
            return [{times:-99999, vals:0}];
        }
        let result = [];
        for(let i = 0; i < a.length; i++){
            result.push({times: a[i], vals: b[i]})
        }
        return result;

    }
    /**
     * flatten 2d array to 1d array
     * @param data 2d array
     * @returns 1d array
     */
    static concatData(data:number[][]):number[]{
        let result:number[] = [];
        for(let i = 0; i < data.length; i++){
            result = result.concat(data[i]);
        }
        return result;
    }
    /**
     * Compute the position on the axis of time given
     * @param width width of the axis
     * @param start start of time
     * @param end end of time
     * @param time time to compute position for
     * @return position of time
     */
    static xPositionFromTime(width: number, start: number, end: number, time: number):number{
        /*
        const {currStart, currEnd} = this.state;
        const length = this.max()-this.min();
        const currWidth = clamp((currEnd - currStart)/length * this.width(), 0, this.width());
        const startLoc = currStart/length * this.width();
        */
        const length = end - start;
        return (time-start)/length * width;
        
    }
    /**
     * Compute time given x position and other time data
     * @param width width of axis
     * @param start start time
     * @param end end time
     * @param xPos position to compute time for
     * @returns 
     */
    static TimeFromXPosition(width: number, start: number, end: number, xPos: number):number{
        const length = end - start;
        let result = (xPos)/width * length;
        if (result > end){
            result = end;
        }else if(result < start){
            result = start
        }
        return result;

    }
    /**
     * check if any update is needed based on prev_map
     * @returns boolean
     */
    prevMapChanged(){
        const {prev_map} = this.props;
        const {prev_lines} = this.state;
        if(prev_map.size === 0){
            // log("prev map empty");
            return true;
        }
        for(const [id, ] of prev_map){
            //this would never be -1 because fillgraphdata changed that
            // if(ind === -1){
            //     log("prev map changed");
            //     return true;
            // }
            if(!(id in prev_lines)){
                // log("prev map changed");
                return true;
            }
        }
        // log("prev map unchanged");
        return false;
    }

    /**
     * handle dragging current time(red vertical line)
     * @param event 
     * @returns 
     */
    dragCurr(event: any){
        const {/*w,*/ time_min, time_max, margin, mouseXCoord, originalMouseXCoord, currDragItem} = this.state;
        let width = this.props.width-margin.right -margin.left;
        // log("in dragCurr, mouseX = "+event.x)
        let xPos = event.x;
        if(xPos > width && this.state.mouseXCoord < 0){
            // log("recorded event.x: "+ xPos);
            this.setState({
                mouseXCoord: xPos,
                currDragItem: "curr"
            })
            return;
        }
        if(xPos > width){
            if(currDragItem !== "curr"){
                return;
            }
            xPos = xPos - mouseXCoord + originalMouseXCoord;
        }
        // while(xPos > width && event.x !== event.subject.x){
        //     // log("decrementing");
        //     // log(event);
        //     xPos -= width;
        // }
        //let xPos = event.x-width;//this cause rectangle to disappeare for a little but no cycling effect
        //let xPos = (event.x>width)? event.x-width: event.x; //this creates cycle effect
        
        let newCurr = LineGraph.TimeFromXPosition(width, time_min, time_max, xPos);
        // log("in dragCurr")
        // log(newCurr);
        if(newCurr < time_min){
            newCurr = time_min;
        }else if(newCurr > time_max){
            newCurr = time_max;
        }
        this.props.onCurrChange(newCurr);
        // this.s?
  
    }
    /**
     * handle dragging start of yellow rectangle
     * @param event 
     * @returns 
     */
    dragStart(event: any){
        const {/*w,*/ time_min, time_max, margin, mouseXCoord, originalMouseXCoord, currDragItem} = this.state;
        let width = this.props.width-margin.right-margin.left;
        // log("in dragStart, mouseX = "+event.x)

        // let xPos = (event.x === event.subject.x)?event.x:event.x-width;
        let xPos = event.x;
        if(event.x < 0){
            xPos = 0;
        }
        if(xPos > width && this.state.mouseXCoord < 0){
            // log("recorded event.x: "+ xPos);
            this.setState({
                mouseXCoord: xPos,
                currDragItem: "start"
            })
            return;
        }
        if(xPos > width){
            if(currDragItem !== "start"){
                return;
            }
                xPos = xPos - mouseXCoord + originalMouseXCoord;

            // }
        }
        let newStart = LineGraph.TimeFromXPosition(width, time_min, time_max, xPos);
        if(newStart > time_max){
            newStart = time_max;
        }else if(newStart < time_min){
            newStart = time_min;
        }
        this.props.onStartChange(newStart);
    }
    /**
     * handle dragging end of yellow triangle
     * @param event 
     * @returns 
     */
    dragEnd(event: any){
        const {/*w,*/ time_min, time_max, margin, mouseXCoord, originalMouseXCoord, currDragItem} = this.state;
        let width = this.props.width-margin.right-margin.left;
        // let xPos = (event.x === event.subject.x)?event.x:event.x-width; 
        let xPos = event.x;
        if(xPos > width && this.state.mouseXCoord < 0){
            // log("recorded event.x: "+ xPos);
            this.setState({
                mouseXCoord: xPos,
                currDragItem: "end"
            })
            return;
        }
        if(xPos > width){
            if(currDragItem !== "end"){
                return;
            }
            xPos = xPos - mouseXCoord + originalMouseXCoord;
        }
        // log("drag End x position is "+xPos );
        // log(event);
        let newEnd = LineGraph.TimeFromXPosition(width, time_min, time_max, xPos);
        if(newEnd > time_max){
            newEnd = time_max;
        }else if(newEnd < time_min){
            newEnd = time_min;
        }
        // log("in dragEnd");
        // log(newEnd);
        this.props.onEndChange(newEnd);

    }
    /**
     * record current mouse position
     * @param event 
     */
    currMouse(event:any){
        this.setState({
            originalMouseXCoord: event.x
        })
    }
    /**
     * record end mouse position
     * @param event 
     */
    endMouse(event:any){
        this.setState({
            mouseXCoord: -1,
            originalMouseXCoord: -1
        })
    }
    createOnClickHandler(line: string) {
        return () => {
            if(this.props.onDeleteChange)
                this.props.onDeleteChange(line);
        };
    }
    /**
     * draws everything in the graph using d3
     * @param boundChangeInZoom 
     * @param colorChange 
     * @param windowChanged 
     * @returns svg node component
     */
    drawGraph(boundChangeInZoom?:boolean, colorChange?:boolean, windowChanged?:boolean, lineWidthChanged?:boolean):any{
        // return 1;
        const {times, vals, 
            startTime, endTime, currTime, 
            isZoom, isTimeWarp, isDiff,
            line_names, line_colors, 
            prev_map, line_ids, title, lineWidth, axisColor,
            onGraphUpdate} = this.props;
        const w = this.props.width;
        const h = this.props.height;
        const isDataChanged = this.prevMapChanged();
        
        const {margin, prev_lines, prev_x, prev_y} = this.state;
        const width = w - margin.left - margin.right - 20;
        const height = h - margin.top - margin.bottom - 20;
        
        // create svg component
        let svg = d3.select(this._graphDiv.current).append("svg").remove()
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", `translate(${margin.left},     ${margin.top})`);

        let [zoomedTimes, zoomedValues] = this.filterData(startTime, endTime);

        let data:data_entry[][] = [LineGraph.parseData(zoomedTimes[0], zoomedValues[0])];
        for(let i = 1; i < zoomedTimes.length; i++){
            data.push(LineGraph.parseData(zoomedTimes[i], zoomedValues[i]))
        }     
        let dragC = d3.drag()
            .on('start', (event:any)=>{this.currMouse(event)})
            .on('drag', (event:any)=>{this.dragCurr(event)})
            .on('end', (event:any)=>{this.endMouse(event)});
  
        let timeConcat = LineGraph.concatData(zoomedTimes);
        let valConcat = LineGraph.concatData(zoomedValues);
        const timeBarStart = LineGraph.xPositionFromTime(width, /*timeMin, timeMax*/d3.min(timeConcat), d3.max(timeConcat), startTime);
        const timeBarCurr = LineGraph.xPositionFromTime(width, /*timeMin, timeMax*/d3.min(timeConcat), d3.max(timeConcat), currTime);
        const timeBarEnd = LineGraph.xPositionFromTime(width, /*timeMin, timeMax*/d3.min(timeConcat), d3.max(timeConcat), endTime);
        // console.log(timeBarStart + " " + (timeBarCurr - 2) + " " + (timeBarEnd - timeBarStart));
        

        // draw the time bar
        svg.append("rect")
            .attr("x", timeBarCurr -1)
            .attr("y", 0)
            .attr("width", 2)
            .attr("height", height)
            .attr("fill", "#b00")
            .attr("fill-opacity","75%");
    
        console.log("width: " + width + " height: " + height);
        // Add X axis and Y axis
        var x_axis: { (arg0: number): number; (arg0: number): number; domain: any; }; //type is generated by Typescript
        var y_axis: { (arg0: number): number; (arg0: number): number; domain: any; };
        if(onGraphUpdate(false) || isDataChanged || boundChangeInZoom || windowChanged || !prev_x || !prev_y || lineWidthChanged){
            x_axis = d3.scaleLinear().range([0, width]).domain(d3.extent(timeConcat));
            y_axis = d3.scaleLinear().range([height, 0]).domain(d3.extent(valConcat));
        }else{
            x_axis = prev_x;
            y_axis = prev_y;
        }
        
        // Set step sizes for x and y axis
        let xAxis = d3.axisBottom(x_axis).tickSize(0).tickPadding(10)
                    .tickValues(d3.range(d3.min(timeConcat), d3.max(timeConcat) + (d3.max(timeConcat)-d3.min(timeConcat))/8, (d3.max(timeConcat)-d3.min(timeConcat))/8));
        let yAxis = d3.axisLeft(y_axis).tickSize(0).tickPadding(10)
                .tickValues(d3.range(d3.min(valConcat), d3.max(valConcat) + (d3.max(valConcat)-d3.min(valConcat))/8, (d3.max(valConcat)-d3.min(valConcat))/8));

        let xAxisGroup = svg.append("g")
            .attr("transform", `translate(0, ${height})`)
            .classed('GraphAxis', true)
            .call(xAxis);

        let yAxisGroup = svg.append("g")
            .classed('GraphAxis', true)
            .call(yAxis);
        
        // draw horizontal y-axis grid lines
        let yAxisGrid = yAxis.tickSizeInner(-width).tickPadding(10).tickFormat("").tickSizeOuter(0);
        let yAxisGridGroup = svg.append("g")
            .classed('GraphGrid', true)
            .call(yAxisGrid);
        
        // hide y-axis
        yAxisGroup.select('.domain')
            .attr('stroke-width', 0);
        yAxisGridGroup.select('.domain')
            .attr('stroke-width', 0);

        // Change color
        xAxisGroup.selectAll("line, path")
            .style("stroke", axisColor);
        yAxisGroup.selectAll("line, path")
            .style("stroke", axisColor);
        yAxisGridGroup.selectAll("line, path")
            .style("stroke", axisColor);
        xAxisGroup.selectAll("text")
            .style("fill", axisColor);
        yAxisGroup.selectAll("text")
            .style("fill", axisColor);

        // add the Line
        let id;
        let valueLine = d3.line()
                    .x((d:data_entry):number => { return x_axis(d.times); })
                    .y((d:data_entry):number => { return y_axis(d.vals); });
        if(isTimeWarp){
            if (data.length === 2) {
                let path1 = svg.append("path").remove()
                    .append("path")
                    .data([data[1]])
                    .attr("class", "line")
                    .attr("fill", "none")
                    .attr("stroke", line_colors[1])
                    .attr("stroke-width", lineWidth)
                    .attr("d", valueLine)
                    .node()

                svg.node().appendChild(path1);
                let path2 = svg.append("path").remove()
                    .append("path")
                    .data([data[0]])
                    .attr("class", "line")
                    .attr("fill", "none")
                    .attr("stroke", line_colors[0])
                    .attr("stroke-width", lineWidth)
                    .attr("d", valueLine)
                    .node()

                svg.node().appendChild(path2);
            } 
        }else{
            for(let i = 0; i < data.length; i++){

                id = line_ids[i];
             
                if(prev_map.get(id) !== -1 && prev_lines.has(id) 
                && !boundChangeInZoom && !colorChange && !windowChanged 
            && !onGraphUpdate(false) && !lineWidthChanged){ //not new select and have previous line
                    // log("reusing line!");
                    // log(id)
                    // log(times)
                    // log(vals);
                    // log(prev_lines.get(id));
                    svg.node().appendChild(prev_lines.get(id));            
                }else{
                    let path = svg.append("path").remove()
                            .append("path")
                            .data([data[i]])
                            .attr("class", "line")
                            .attr("fill", "none")
                            .attr("stroke", line_colors[i])
                            .attr("stroke-width", lineWidth)
                            .attr("d", valueLine)
                            .node()
                    // log(path);
                    svg.node().appendChild(path);
                    prev_lines.set(id, path);
                }
                // .on("mouseover", (d:any, i:any)=>{log(d); log(i);} ) //d is MouseEvent, i is array
                               
            }
        }
        let xLab = "Time";
        let yLab = title;
        if(isTimeWarp){
            xLab = "Base Scene Time";
            yLab = "Time Warped Scene Time";

        }
        //add x label
        svg.append("text")
            .attr("class", "xLabel")
            .attr("fill", axisColor)
            .attr("text-anchor", "middle")
            .attr("x", width*0.50)
            .attr("y", height + 35 )
            .text(xLab);

        //add y label
        svg.append("text")
          .attr("class", "yLabel")
          .attr("fill", axisColor)
          .attr("text-anchor", "middle")
          // .attr("x", -20)
          // .attr("y", -7 )
          // for rotated label - issue: overlaps with y axis ticks
          .attr("y", -45) //actual x
          .attr("x", -(height * 0.5)) //actual y
          //.attr("dy", ".35em")
          .attr("transform", "rotate(-90)")
          .text(yLab);

        //add draggable components(just rectangles)
        svg.append("rect")
                .attr("x", timeBarCurr -20)
                .attr("y", 0)
                .attr("width", 40)
                .attr("height", height)
                .attr("fill", "#b00")
                .attr("fill-opacity","0%")
                .call(dragC);
            
        this.setState({
            // w: width + margin.lthis.stateeft + margin.right,
            // h: height + margin.top + margin.bottom,
            prev_lines: prev_lines,
            prev_x: x_axis,
            prev_y: y_axis,
            // newCurr: newCurr

            time_min: d3.min(timeConcat), 
            time_max: d3.max(timeConcat),
        });
        onGraphUpdate(true);
        return svg.node();
        

    }
    render() {
        //const {w, h} = this.state;
        const {isZoom, isDiff, isTimeWarp, times, title, selected, axisColor} = this.props;
        let styles = {display: "inline-block", marginBottom: "10px", color: axisColor};
        // if(selected !== undefined && selected)
        //     styles = {display: "inline-block", marginBottom: "10px", color:"yellow"}
        // else
        //     styles = {display: "inline-block", marginBottom: "10px"}
        return (
            <div>
                {/* {!isZoom&&!isDiff&&!isTimeWarp&&
                <div style={{textAlign: "center"}}>
                    <p style={styles}>{title} Graph</p>
                </div>
                } */}
                {isZoom&&!isDiff&&!isTimeWarp&&times.length !== 0&&<p style={styles}>Zoomed-in Pos/Vel/Acc/Jerk Graph</p>}
                {!isZoom&&isDiff&&!isTimeWarp&&
                <div style={{textAlign: "center"}}>
                    <p style={styles}>{title} Difference Graph</p>
                </div>
                }
                {!isZoom&&!isDiff&&isTimeWarp&&<p style={styles}>{title} Graph</p>}
                <div className="lineGraph" ref={this._graphDiv}>
                </div>
            </div>
        );
    }
}
