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
        const {width, height} = this.props;
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
        const {height, width} = this.props;
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
            const {width, height} = this.props;
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
        const legendW = w * 0.5;
        const isDataChanged = this.prevMapChanged();
        
        const {margin, prev_lines, prev_x, prev_y} = this.state;
        //width = w - margin.left - margin.right,
        const width = w - margin.left - margin.right,
        height = h - margin.top - margin.bottom;
        
        // create svg component
        let svg = d3.select(this._graphDiv.current).append("svg").remove()
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},     ${margin.top})`);

        // const min = 0, max = 8; // default min and max of x and y axis
        // if(!times.length || !vals.length){
        //     // draw an empty graph
        //     // log("Warning: Empty times and vals for LineGraph")

        //     const timeBarCurr = LineGraph.xPositionFromTime(width, startTime, endTime, currTime);
        //     // console.log(startTime + " " + endTime + " " + width);
        //     // console.log(this.props.width);
        //     svg.append("rect")
        //         .attr("x", timeBarCurr -1)
        //         .attr("y", 0)
        //         .attr("width", 2)
        //         .attr("height", height)
        //         .attr("fill", "#b00")
        //         .attr("fill-opacity","75%");

        //     x_axis = d3.scaleLinear().range([0, width]);
        //     y_axis = d3.scaleLinear().range([height, 0]);
        //     x_axis.domain(d3.extent([startTime, endTime]));
        //     y_axis.domain(d3.extent([min, max]));
        //     let xAxis = svg.append("g")
        //         .attr("transform", `translate(0, ${height})`)
        //         .call(d3.axisBottom(x_axis).tickSize(0));
        //     let yAxis = svg.append("g")
        //         .call(d3.axisLeft(y_axis).tickSize(0));

        //     xAxis.selectAll("line, path")
        //         .style("stroke", axisColor);
        //     yAxis.selectAll("line, path")
        //         .style("stroke", axisColor);
        //     xAxis.selectAll("text")
        //         .style("fill", axisColor);
        //     yAxis.selectAll("text")
        //         .style("fill", axisColor);
            
        //     onGraphUpdate(true);
        //     return svg.node();
        // }

        let [zoomedTimes, zoomedValues] = this.filterData(startTime, endTime);

        let data:data_entry[][] = [LineGraph.parseData(zoomedTimes[0], zoomedValues[0])];
        for(let i = 1; i < zoomedTimes.length; i++){
            data.push(LineGraph.parseData(zoomedTimes[i], zoomedValues[i]))
        }     
        let dragC = d3.drag()
            .on('start', (event:any)=>{this.currMouse(event)})
            .on('drag', (event:any)=>{this.dragCurr(event)})
            .on('end', (event:any)=>{this.endMouse(event)});
            
        // let dragS = d3.drag()
        //     .on('start', (event:any)=>{this.currMouse(event)})
        //     .on('drag', (event:any)=>{this.dragStart(event)})
        //     .on('end', (event:any)=>{this.endMouse(event)});
        // let dragE = d3.drag()
        //     .on('start', (event:any)=>{this.currMouse(event)})
        //     .on('drag', (event:any)=>{this.dragEnd(event)})
        //     .on('end', (event:any)=>{this.endMouse(event)}); 
        
        let timeConcat = LineGraph.concatData(zoomedTimes);
        let valConcat = LineGraph.concatData(zoomedValues);
        const timeBarStart = LineGraph.xPositionFromTime(width, /*timeMin, timeMax*/d3.min(timeConcat), d3.max(timeConcat), startTime);
        const timeBarCurr = LineGraph.xPositionFromTime(width, /*timeMin, timeMax*/d3.min(timeConcat), d3.max(timeConcat), currTime);
        const timeBarEnd = LineGraph.xPositionFromTime(width, /*timeMin, timeMax*/d3.min(timeConcat), d3.max(timeConcat), endTime);
        // console.log(timeBarStart + " " + (timeBarCurr - 2) + " " + (timeBarEnd - timeBarStart));
        

        // draw the time bar
        // if(isZoom){ //zoomed graph 
            svg.append("rect")
                .attr("x", timeBarCurr -1)
                .attr("y", 0)
                .attr("width", 2)
                .attr("height", height)
                .attr("fill", "#b00")
                .attr("fill-opacity","75%");
        // } else{
        //     svg.append("rect")
        //         .attr("x", timeBarStart)
        //         .attr("y", 0)
        //         .attr("width", timeBarEnd - timeBarStart)
        //         .attr("height", height)
        //         .attr("fill", "#ff0")
        //         .attr("fill-opacity","15%");     

        //     svg.append("rect")
        //         .attr("x", timeBarCurr -2)
        //         .attr("y", 0)
        //         .attr("width", 4)
        //         .attr("height", height)
        //         .attr("fill", "#b00")
        //         .attr("fill-opacity","75%");
        // }

        
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

                // let tooltip = d3.select(this._graphDiv.current)
                //     .append("div")
                //     .style("opacity", 0)
                //     .attr("class", "tooltip")
                //     .style("background-color", "white")
                //     .style("border", "solid")
                //     .style("border-width", "2px")
                //     .style("border-radius", "5px")
                //     .style("padding", "5px")
                // let mouseover = function(d:MouseEvent)
                // let valueLine;
                id = line_ids[i];
                //const id_content = id.split("&");
                //const type = id_content[id_content.length-1];
                // log(type);
                // if(type === "position"){
                //     log("ehre in position")
                    
                // }else{
                //     valueLine = d3.line()
                //         .curve(d3.curveBundle.beta(0.9)) //not very effective
                //         .x((d:data_entry):number => { return x_axis(d.times); })
                //         .y((d:data_entry):number => { return y_axis(d.vals); });
                // }
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


        //draw legend
        
        // if (this.props.legend) {
        //   // if(!isTimeWarp){
        //     const legend_start_x = 0;
        //     const legend_start_y = h;
        //   svg
        //     .append("rect")
        //     .attr("x", legend_start_x)
        //     .attr("y", legend_start_y)
        //     .attr("width", legendW)
        //     .attr("height",50 * (line_names.length + 1) + 35)
        //     .attr("stroke", "#ccc")
        //     .attr("fill-opacity", "75%");
        //   svg
        //     .append("text")
        //     // .attr("class", "x label")
        //     .attr("fill", "white")
        //     .attr("text-anchor", "middle")
        //     .attr("x", legend_start_x + legendW / 2)
        //     .attr("y", 30 + legend_start_y)
        //     .style("font-weight", 600)
        //     .style("font-size", "16px")
        //     .text("Legend");
        //   let legend_y = 35 + legend_start_y;

        //   // Create right-click context menu

        //   const contextMenu = svg
        //     .append("g")
        //     .attr("class", "context-menu")
        //     .style("display", "none");

        //   document.addEventListener("click", () => {
        //     // Hide the context menu
        //     contextMenu.style("display", "none");
        //   });

        //   const option_width = 80,  // the width and height of an right-click menu option
        //     option_height = 20;
        //   const start_x = -70,  // the offset of the option
        //     start_y = -15;
        //   const option1 = contextMenu
        //     .append("g") // Create a group element
        //     .attr("class", "option")
        //     .attr("transform", `translate(${start_x},${start_y})`)
        //     .style("cursor", "pointer")
        //     .on("click", () => {
        //       // Option 1 click handler
        //       console.log("Option 1 clicked");
        //     });

        //   option1
        //     .append("rect")
        //     .attr("width", option_width)
        //     .attr("height", option_height)
        //     .attr("fill", "white");

        //   option1
        //     .append("text")
        //     .attr("x", option_width / 2)
        //     .attr("y", option_height / 2)
        //     .attr("text-anchor", "middle")
        //     .attr("dominant-baseline", "central")
        //     .style("font-size", "12px")
        //     .style("fill", "black")
        //     .text("Select as line1");

        //   const option2 = contextMenu
        //     .append("g") // Create a group element
        //     .attr("class", "option")
        //     .attr(
        //       "transform",
        //       `translate(${start_x},${start_y + option_height})`
        //     )
        //     .style("cursor", "pointer")
        //     .on("click", () => {
        //       // Option 2 click handler
        //       console.log("Option 2 clicked");
        //     });

        //   option2
        //     .append("rect")
        //     .attr("width", option_width)
        //     .attr("height", option_height)
        //     .attr("fill", "white");

        //   option2
        //     .append("text")
        //     .attr("x", option_width / 2)
        //     .attr("y", option_height / 2)
        //     .attr("text-anchor", "middle")
        //     .attr("dominant-baseline", "central")
        //     .style("font-size", "12px")
        //     .style("fill", "black")
        //     .text("Select as line2");

        //   const radius = 8; // radius of the circle
        //   const xSize = 6; // the size of the "X"
        //   legend_y += 22;
        //   for (let i = 0; i < line_names.length; i++) {
            
        //     svg
        //       .append("circle")
        //       // .attr("class", "x label")
        //       .attr("fill", line_colors[i])
        //       .attr("cx", legend_start_x + 15)
        //       .attr("cy", legend_y - 4)
        //       .attr("r", radius);

        //     let line_name = line_names[i];

        //     if (!isDiff && !isTimeWarp) {
        //       // draw "X". Whenever the user clicks it, it remove the current line in the graph
        //       const x_offset = 0.99 * legendW - 2 * xSize; //272
        //       const line1 = svg
        //         .append("line")
        //         .attr("x1", legend_start_x + x_offset)
        //         .attr("y1", legend_y - 4 - xSize)
        //         .attr("x2", legend_start_x + x_offset + 2 * xSize)
        //         .attr("y2", legend_y - 4 + xSize)
        //         .attr("stroke", "red")
        //         .attr("stroke-width", 2)
        //         .style("cursor", "pointer")
        //         .on("click", this.createOnClickHandler(line_ids[i]));

        //       const line2 = svg
        //         .append("line")
        //         .attr("x1", legend_start_x + x_offset)
        //         .attr("y1", legend_y - 4 + xSize)
        //         .attr("x2", legend_start_x + x_offset + 2 * xSize)
        //         .attr("y2", legend_y - 4 - xSize)
        //         .attr("stroke", "red")
        //         .attr("stroke-width", 2)
        //         .style("cursor", "pointer")
        //         .on("click", this.createOnClickHandler(line_ids[i]));
        //     }
            

        //       const c_length = 6.8; // the length of a single character
        //       const line_width = 0.9 * legendW - 2 * xSize - 2 * radius;
        //       const line_counts = Math.ceil(line_name.length * c_length / line_width);
        //       const line_height = line_counts * 20;
        //       console.log("line count: " + line_counts)
        //       console.log("line height: " + line_height)
        //       const foreignObject = svg
        //         .append("foreignObject")
        //         .attr("x", legend_start_x + 25)
        //         .attr("y", legend_y - radius * 2)
        //         .attr("width", line_width) // Set the maximum width for text wrapping
        //         .attr("height", line_height);
        //         // Set the height of the foreignObject
        //         ((line: string) => {
        //           const div = foreignObject
        //             .append("xhtml:div")
        //             .style("font-weight", 600)
        //             .style("font-size", "13px")
        //             .style("max-width", "100%")
        //             .style("color", line_colors[i]) // Set the text color
        //             .html(
        //               `<p style="word-wrap: break-word; margin: 0;">${line_name}</p>`
        //             );

        //           div.on("contextmenu", (event: MouseEvent) => {
        //             // Prevent default right-click event
        //             event.preventDefault();

        //             const svgElement = svg.node();
        //             const svgRect = svgElement.getBoundingClientRect();

        //             // Get the adjusted mouse coordinates relative to the SVG element
        //             const mouseX = event.pageX - svgRect.left;
        //             const mouseY = event.pageY - svgRect.top;

        //             //   console.log(
        //             //     "should be x: " +
        //             //       (legend_start_x + 25) +
        //             //       " y: " +
        //             //       legend_y
        //             //   );
        //             //   console.log("x: " + mouseX + " y: " + mouseY);

        //             // Position the context menu at the mouse coordinates
        //             contextMenu.attr(
        //               "transform",
        //               `translate(${mouseX}, ${mouseY})`
        //             );

        //             // Show the context menu
        //             contextMenu.style("display", "block");
        //             option1.on("click", () => {
        //               // Option 1 click handler
        //               if (this.props.onSelectLine)
        //                 this.props.onSelectLine(line, 0);
        //             });

        //             option2.on("click", () => {
        //               // Option 2 click handler
        //               if (this.props.onSelectLine)
        //                 this.props.onSelectLine(line, 1);
        //             });

        //             // Move the context menu container to the end of the SVG element's children
        //             svg.node().appendChild(contextMenu.node());
        //           });
        //         }
        //       )(line_ids[i]);
              
              
        //      legend_y += line_height;
        //     // add line names
        //    /* while (line_name.length > 0) {
        //       ((line: string) => {
        //         svg
        //           .append("text")
        //           // .attr("class", "x label")
        //           .attr("fill", line_colors[i])
        //           .attr("text-anchor", "start")
        //           .attr("x", legend_start_x + 25)
        //           .attr("y", legend_y)
        //           .style("font-weight", 600)
        //           .style("font-size", "13px")
        //           .text(line_name.substring(0, 31))
        //           .on("contextmenu", (event: MouseEvent) => {
        //             // Prevent default right-click event
        //             event.preventDefault();

        //             const svgElement = svg.node();
        //             const svgRect = svgElement.getBoundingClientRect();

        //             // Get the adjusted mouse coordinates relative to the SVG element
        //             const mouseX = event.pageX - svgRect.left;
        //             const mouseY = event.pageY - svgRect.top;

        //             //   console.log(
        //             //     "should be x: " +
        //             //       (legend_start_x + 25) +
        //             //       " y: " +
        //             //       legend_y
        //             //   );
        //             //   console.log("x: " + mouseX + " y: " + mouseY);

        //             // Position the context menu at the mouse coordinates
        //             contextMenu.attr(
        //               "transform",
        //               `translate(${mouseX}, ${mouseY})`
        //             );

        //             // Show the context menu
        //             contextMenu.style("display", "block");
        //             option1.on("click", () => {
        //               // Option 1 click handler
        //               if(this.props.onSelectLine)
        //                 this.props.onSelectLine(line, 0);
        //             });

        //             option2.on("click", () => {
        //               // Option 2 click handler
        //               if(this.props.onSelectLine)
        //                 this.props.onSelectLine(line, 1);
        //             });
                  

        //         // Move the context menu container to the end of the SVG element's children
        //         svg.node().appendChild(contextMenu.node());
        //       })
        //     })(line_ids[i]);
        //       line_name = line_name.substring(31);
        //       legend_y += 16;
        //     }*/

        //     //legend_y -= 16;
        //   }
        // }
        
        

        //add draggable components(just rectangles)
        svg.append("rect")
                .attr("x", timeBarCurr -20)
                .attr("y", 0)
                .attr("width", 40)
                .attr("height", height)
                .attr("fill", "#b00")
                .attr("fill-opacity","0%")
                .call(dragC);
            
        // svg.append("rect")
        //     .attr("x", timeBarStart)
        //     .attr("y", 0)
        //     .attr("width", 30)
        //     .attr("height", height)
        //     .attr("fill", "#ff0")
        //     .attr("fill-opacity","0%")
        //     .call(dragS);

        // svg.append("rect")
        //     .attr("x", timeBarEnd-30)
        //     .attr("y", 0)
        //     .attr("width", 30) 
        //     .attr("height", height)
        //     .attr("fill", "#ff0")
        //     .attr("fill-opacity","0%")
        //     .call(dragE);

        
        this.setState({
            // w: width + margin.left + margin.right,
            // h: height + margin.top + margin.bottom,
            prev_lines: prev_lines,
            prev_x: x_axis,
            prev_y: y_axis,
            // newCurr: newCurr

            time_min: d3.min(timeConcat), 
            time_max: d3.max(timeConcat),
        });
        // this._graphDiv.current!.appendChild(svg.node());
        // let temp = d3.select(this._graphDiv.current).append("svg")
        //     .attr("width", width + margin.left + margin.right)
        //     .attr("height", height + margin.top + margin.bottom)
        //     .append(svg)
        // this._graphDiv.current!.appendChild(temp);
        // log(svg.node());
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
