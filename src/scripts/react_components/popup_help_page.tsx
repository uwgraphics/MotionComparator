import { ReactElement } from "react";
import { APP } from "../constants";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

// GIFs
import UmapOption_CreateUmap from "../../assets/UmapOption_CreateUmap.gif";
import UmapOption_ChangeColor from "../../assets/UmapOption_ChangeColor.gif";
import UmapOption_ChangeParams from "../../assets/UmapOption_ChangeParams.gif";
import UmapOption_ChangeLineWidth from "../../assets/UmapOption_ChangeLineWidth.gif";
import Umap_AddLine from "../../assets/Umap_AddLine.gif";
import Umap_OpenLegend from "../../assets/Umap_OpenLegend.gif";
import QScene_ChangeSettings from "../../assets/QScene_ChangeSettings.gif";
import QScene_CreateQScene from "../../assets/QScene_CreateQScene.gif";

import DragAndDropToOpenA3DScene from "../../assets/DragAndDropToOpenA3DScene.gif"
import AddGhostToScene from "../../assets/AddGhostToScene.gif"
import AddTraceToScene from "../../assets/AddTraceToScene.gif"
import DeleteObjectFromScene from "../../assets/DeleteObjectFromScene.gif";
import CreationOfNewEmptyScene from "../../assets/CreationOfNewEmptyScene.gif";
import CloningScene from "../../assets/CloningScene.gif";

import CreatingEmptyGraphs from "../../assets/CreatingEmptyGraphs.gif";
import ChangingThePropertiesOfAGraph from "../../assets/ChangingThePropertiesOfAGraph.gif";

import AddJointValueToGraph from "../../assets/AddJointValueToGraph.gif";
import DragAndDropLegendOfGraph from "../../assets/DragAndDropLegendOfGraph.gif";

import PictureOfDifferenceGraphWithDifferences from "../../assets/PictureOfDifferenceGraphWithDifferences.png"
import PictureOfDifferenceGraphWithNoDifferences from "../../assets/PictureOfDifferenceGraphWithNoDifferences.png"

import CreationAndPopulationOfDiffGraph from "../../assets/CreationAndPopulationOfDiffGraph.gif"
import DragAndDropDifferenceGraphLegend from "../../assets/DragAndDropDifferenceGraphLegend.gif"

import ClickingOnSceneToSelectIt from "../../assets/ClickingOnSceneToSelectIt.gif"
import SceneOptionsPanelScreenshot from "../../assets/SceneOptionsPanelScreenshot.png"

import SelectingRobotByClickingOnIt from "../../assets/SelectingRobotByClickingOnIt.gif"
import SelectingRobotViaSelectionPanel from "../../assets/SelectingRobotViaSelectionPanel.gif"
import RobotOptionsPanelScreenshot from "../../assets/RobotOptionsPanelScreenshot.png"

import TimeBarBeingScrubbed from "../../assets/TimeBarBeingScrubbed.gif"
import TimeBarBeingPlayedPausedReset from "../../assets/TimeBarBeingPlayedPausedReset.gif"

import ColoredTimeBarInUse from "../../assets/ColoredTimeBarInUse.gif"
import DoubleTimeBarPlaying from "../../assets/DoubleTimeBarPlaying.gif"
import DoubleTimeBarBeingScrubbed from "../../assets/DoubleTimeBarBeingScrubbed.gif"

import LooadingInExampleRobot from "../../assets/LooadingInExampleRobot.gif"
import SceneLegendAndDeletionOfTraces from "../../assets/SceneLegendAndDeletionOfTraces.gif"
import SceneOptionsEditingScene from "../../assets/SceneOptionsEditingScene.gif"

import RobotOptionsRobotEditing from "../../assets/RobotOptionsRobotEditing.gif"


import LoadAndSavePanelScreenshot from "../../assets/LoadAndSavePanelScreenshot.png"
import LS_Workspace from "../../assets/LS_Workspace.gif"


/**
 * An enum denoting what page of the popups should currently be shown.
 */
export enum PopupHelpPage {
    /** There should currently be no popup shown. */
    None = "None",
    /** The home popup help page shoud be shown. */
    Home = "Home",
    LoadAndSavePanel = "Load&Save",
    DifferenceGraphPanel = "Difference Graph",
    GraphOptionPanel = "Graph Options",
    GraphPanel = "Graph",
    UmapGraphOptionPanel = "Umap Graph Option",
    UmapGraphPanel = "Umap Graph",
    TimeWarpedGraphPanel = "Time Warped Graph",
    SelectionPanel = "Selection",
    RobotOptionPanel = "Robot Options",
    QSceneOptionPanel = "Quaternion Options",
    SceneOptionPanel = "Scene Options",
    LegendPanel = "Legend",
    TimeBarPanel = "Time Bar",
    WarpedTimeBarPanel = "Time Warped Time Bar",

    //Scene = "Scene", // help page to describe what a "scene" is
    //Object = "Object", // help page to describe what an "object" is
    TimeWarping = "Time Warping", // page that describes what "time warping" is.
    Umap = "UMAP", // help page that describes what a "UMAP" is
    Qscene = "Quaternion Space Scene",
    AnimationCSV = "Animation CSV",

    // page to show when a page is not found
    PageNotFound = "Page Not Found",

    // loading pages
    LoadingStarted = "Loading Started",
    LoadingFailed = "Loading Failed",
    LoadingSuccess = "Loading Success",
}

/**
 * The parameters allowed for creating popup pages.
 */
export type PopupHelpPageParams =
        { page: Exclude<PopupHelpPage, PopupHelpPage.LoadingStarted | PopupHelpPage.LoadingFailed | PopupHelpPage.LoadingSuccess | PopupHelpPage.PageNotFound>} |
        { page: PopupHelpPage.LoadingStarted, location?: string, type?: string } | // can give the location of the workspace being loaded
        { page: PopupHelpPage.LoadingFailed,  location?: string, type?: string, error?: string } | // can give the location of the workspace being loaded and the error that caused it to fail to load
        { page: PopupHelpPage.LoadingSuccess, location?: string, type?: string } | // can give the location of the workspace being loaded
        { page: PopupHelpPage.PageNotFound, pageName?: string } // can give the page that was not found
;

/**
 * @param params The new help page to switch to.
 * @param params The parameters for the page.
 * @returns The div for the given help page.
 */
export function popupHelpPageDiv(params: PopupHelpPage | PopupHelpPageParams): ReactElement {
    let _params = (typeof params === "string" ? { page: params } : params);

    let pageNameCleaned = _params.page.replaceAll(" ", "");

    // get popup content
    let content = popupHelpPageContent(_params);
    if (content === null) {
        return <></>; // no popup
    }

    return (<div>
        <div className={`HelpPopup HelpPopup-${pageNameCleaned}`}>
            {_params.page !== PopupHelpPage.LoadingStarted &&
                <button className="Xmark" onClick={() => APP.setPopupHelpPage(PopupHelpPage.None)}>
                    <FontAwesomeIcon icon={faXmark} />
                </button>}
            <div className="content">
                {content}
            </div>
        </div>
        <div className="overlay"></div>
    </div>);
}

/**
 * Creates and returns a new button that will go to the given popup page.
 * @param page The page to go to when this button is clicked.
 * @param buttonContent The text that the button will display.
 * @param params The parameters to give to the popup page.
 * @param className Any React classes that should be put on the button.
 * @returns A button that goes to the specified popup page.
 */
function goTo(page: PopupHelpPage | PopupHelpPageParams, buttonContent?: string, className: string = ""): ReactElement {
    let pageName = (typeof page === "string" ? page : page.page );
    return (<span>
        <button
            className={className}
            onClick={() => APP.setPopupHelpPage(page)}>
            {buttonContent ? buttonContent : pageName}
        </button>
    </span>);
}

/**
 * @returns A link to the home page of the application.
 */
function homePageLink(): ReactElement {
    return <>
        <p>{goTo(PopupHelpPage.Home)}</p>
    </>;
}

const HELP_BODY = "HelpBody";
const HELP_TITLE = "HelpTitle";

/**
 * Gets the content of a popup page.
 * @param params The page to get content for.
 * @param params The parameters for the popup page.
 * @returns Returns the content of the given page or null if the popup should be closed.
 */
function popupHelpPageContent(params:PopupHelpPageParams): ReactElement | null {
    // the parameters of the page
    
    if (params.page === PopupHelpPage.None) {
        return null;
    } else if (params.page === PopupHelpPage.Home) {
        return <div>
            <h1 className={HELP_TITLE}>Motion Comparator</h1>
            <div className={HELP_BODY}>
                <h3>Key Features</h3>
                <ul>
                    <li>Viewable 3D scenes</li>
                    <li>Convenient time-series plots</li>
                    <li>Scrubbable time bars</li>
                    <li>Object traces in cartesian space</li>
                    <li>Quaternion traces</li>
                    <li>UMAP graphs of robot joint states</li>
                    <li>Time warping for temporary motion alignment</li>
                    <li>Juxtaposition, superposition, and explicit encoding designs</li>
                    <li>Hyper-customizable and sharable layouts</li>
                </ul>
                <br></br>
                <h3> Panels </h3>
                Panels are modular visualization interfaces that can be
                configured and arranged into customizable layouts. Each panel
                has its own help page that you can get to either from here or
                from the panel itself. 
                <ul>
                    <li>A {goTo(PopupHelpPage.LoadAndSavePanel)} panel loads or saves motion data.  </li>
                    <li>A {goTo(PopupHelpPage.SelectionPanel)} panel allows you to see and select any part of any object in any scene. You can also create 3D scenes, traces, and various visualization using this panel.</li>
                    <li>A {goTo(PopupHelpPage.TimeBarPanel)} panel shows the current time, start time, and end time of of the application.</li>
                    <li>A {goTo(PopupHelpPage.DifferenceGraphPanel)} panel shows the differences between elements in a scene.</li>           
                    <li>A {goTo(PopupHelpPage.GraphOptionPanel)} panel customizes the graph panel.</li>
                    <li>A {goTo(PopupHelpPage.GraphPanel)} panel visualizes robot motions in time-series plots.</li>
                    <li>A {goTo(PopupHelpPage.LegendPanel)} panel shows the legend of a graph.</li>
                    <li>A {goTo(PopupHelpPage.UmapGraphPanel)} panel maps the higher-dimentional joint data to a lower-dimensional graph.</li>
                    <li>A {goTo(PopupHelpPage.UmapGraphOptionPanel)} panel allows you to change the look details of a UMAP panel.</li>
                    <li>A {goTo(PopupHelpPage.TimeWarpedGraphPanel)} panel graphs the time warp between two time-warped scenes.</li>           
                    <li>A {goTo(PopupHelpPage.RobotOptionPanel)} panel allows some aspects of a robot (such as its position and rotation) to be edited.</li>
                    <li>A {goTo(PopupHelpPage.SceneOptionPanel)} panel allows customization of the 3D scene. Aspects such as lighting, background color, and time-warping objectives can be edited using this panel.</li>
                    <li>A {goTo(PopupHelpPage.QSceneOptionPanel)} panel maps the rotation of an item (such as a robot or joint) over the course of its motion.</li>
                    <li>A {goTo(PopupHelpPage.WarpedTimeBarPanel)} panel is like the {goTo(PopupHelpPage.TimeBarPanel)} panel but with extra options for time warped data.</li>
                </ul>
                <h3> Other Pages </h3>
                <ul>
                    <li>The {goTo(PopupHelpPage.Umap)} page describes what a "UMAP" is. </li>
                    <li>The {goTo(PopupHelpPage.TimeWarping)} page describes what "time warping" is. </li>
                    <li>The {goTo(PopupHelpPage.AnimationCSV)} page describes the animation CSV format. </li>
                </ul>
            </div>
        </div>;
    } else if (params.page === PopupHelpPage.SelectionPanel) {
        return <div>
            <h1 className={HELP_TITLE}>Selection Panel</h1>
            <div className={HELP_BODY}>
                {homePageLink()}
                <p>
                    This panel lists out all scenes, robots, and robot joints in
                    a hierarchy so that they can be found and selected with
                    ease.
                </p>
                <br></br>

                <h3> Openning a 3D scene </h3>
                <p>
                    Scenes are shown as the top level of the selection
                    hierarchy.
                </p>
                <p>
                    You can open a scene by clicking and dragging it into the
                    current workspace.
                </p>
                <img src={DragAndDropToOpenA3DScene} alt={"A gif showing how to open a 3D scene"} />

                <h3> Adding a ghost robot to a 3D scene </h3>
                <p>
                    Objects (such as robots) only exist within scenes and therefore
                    appear as the children of scenes within the selection hierarchy.
                </p>
                <p>
                    You can add the ghost of an object to a scene by clicking and
                    dragging the object's name into the scene you want its ghost
                    to appear in.
                </p>
                <img src={AddGhostToScene} alt={"A gif showing how to add a ghost robot"} />

                <h3> Adding the Trace of a Joint </h3>
                <p>
                    Since joints can only appear as part of an object (since all
                    robots are objects) joints appear as the children of objects
                    within the selection hierarchy.
                </p>
                <p>
                    You can add the trace of an object's joint by clicking and
                    dragging the joint's name into the scene you would like the
                    trace to appear in.
                </p>
                <img src={AddTraceToScene} alt={"a gif showing a joint's trace being added to a scene"} />

                <h3> Deleting an Object </h3>
                <p>
                    An object can be deleted from a scene by clicking the trash
                    icon next to it in the selection hierarchy.
                </p>
                <img src={DeleteObjectFromScene} alt={"a gif showing the deletion of an object"} />

                <h3> Creating a new Scene </h3>
                <p>
                    A new, empty scene can be created by clicking the "New Scene" button.
                </p>
                <img src={CreationOfNewEmptyScene} alt={"a gif showing the creation of a scene"} />

                <p>
                    To learn about how to add objects/animations to the newly
                    created scene, go to the {goTo(PopupHelpPage.LoadAndSavePanel)} page.
                </p>

                <h3> Cloning a Scene </h3>
                <p>
                    A scene can be cloned by clicking on the scene you desire to
                    clone and then clicking the "Clone Scene" button.
                </p>
                <img src={CloningScene} alt={"a gif of a scene being cloned"} />
            </div>
        </div>;
    } else if (params.page === PopupHelpPage.GraphOptionPanel) { 
        return <div>
            <h1 className={HELP_TITLE}>Graph Options Panel</h1>
            {homePageLink()}
            <div className={HELP_BODY}>
                <p>
                    This panel is used to create new {goTo(PopupHelpPage.GraphPanel)} panels 
                    and new {goTo(PopupHelpPage.DifferenceGraphPanel)} panels. It also
                    allows you to edit said panels.
                </p>

                <h3> Adding a Line </h3>
                <p>
                    To learn how to add a line to a graph (i.e. graph some
                    aspect of an object) go to the {goTo(PopupHelpPage.GraphPanel)} or {goTo(PopupHelpPage.DifferenceGraphPanel)} page.
                </p>

                <h3> Creating a Graph Panel </h3>
                <p>
                    To create a new {goTo(PopupHelpPage.GraphPanel)} or {goTo(PopupHelpPage.DifferenceGraphPanel)} panel,
                    click and drag the text that says "New Graph" or "Difference Graph" into the workspace.
                </p>
                <img src={CreatingEmptyGraphs} alt={"gif of a graph panel being clicked and dragged into the workspace"} />
                <p>
                    To edit the panel after you have created it, first select
                    the graph panel you want to edit by clicking on it. Then,
                    you can use the "property" dropbox of the {goTo(PopupHelpPage.GraphOptionPanel)} panel
                    to edit what aspect of each joint/object is being graphed.
                </p>
                <img src={ChangingThePropertiesOfAGraph} alt={"gif of person changing the properties of a graph"} />
            </div>
        </div>;
    } else if (params.page === PopupHelpPage.GraphPanel) {
        return <div>
            <h1 className={HELP_TITLE}>Graph Panel</h1>
            {homePageLink()}
            <div className={HELP_BODY}>
                <p>
                    Each panel of this type contains a 2D plot where time is the
                    x-axis and some other aspect of a robot (such as the
                    position or rotation of its joint(s)) is graphed on the y-axis.
                </p>
                <p>
                    You can create an empty graph via the
                    {goTo(PopupHelpPage.GraphOptionPanel)} panel.
                </p>

                <h3> Adding a Line</h3>
                <p>
                    To graph an object's joint, click and drag it from the
                    {goTo(PopupHelpPage.SelectionPanel)} panel and into the
                    graph panel.
                </p>
                <img src={AddJointValueToGraph} alt={"A gif showing an object's joint being clicked and dragged into a graph panel"} />
                <p>
                    This can be done for as many joints as you wish.
                </p>

                <p>
                    To learn more about how to edit the graph, go to the
                    {goTo(PopupHelpPage.GraphOptionPanel)} panel.
                </p>

                <h3> Opening a Legend </h3>
                <p>
                    In addition to the graph panel itself, a linked panel can be
                    used to show the legend of the graph i.e. what the graph
                    graphs.
                </p>
                <p>
                    To see the legend of a graph, click and drag the button that
                    says "Legend" into the workspace, and a
                    {goTo(PopupHelpPage.LegendPanel)} will appear.
                </p>
                <img src={DragAndDropLegendOfGraph} alt={"a gif to show how to click and drag to open a legend"} />
            </div>
        </div>;
    } else if (params.page === PopupHelpPage.DifferenceGraphPanel) { 
        return <div>
            <h1 className={HELP_TITLE}>Difference Graph Panel</h1>
            {homePageLink()}
            <div className={HELP_BODY}>
                <p>
                    Panels of this type graph the differences between two aspects
                    of two motions.
                </p>
                <p>
                    For example, below you can see a graph of the end effector
                    positions for two robots over the course of their
                    animations.
                </p>
                <img src={PictureOfDifferenceGraphWithDifferences} alt={"picture of difference graph"} />
                <p>
                    If we time warp the two scenes and then graph them again,
                    you can now see that their end effectors follow the exact
                    same path (i.e. the difference between their time-warped end
                    effectors are now 0 at every time step), they just do so at
                    different times.
                </p>
                <img src={PictureOfDifferenceGraphWithNoDifferences} alt={"picture of difference graph where end effector differences are now 0 at every time step"} />

                <h3> Graphing Elements </h3>
                <p>
                    When first created, the graph will be empty except
                    for a red, vertical bar that shows the current time as it
                    corresponds on the graph.
                </p>
                <p>
                    You can then graph the difference between two elements of two
                    motions by dragging and dropping said elements into the
                    difference graph.
                </p>
                <img src={CreationAndPopulationOfDiffGraph} alt={"gif of dragging and dropping said elements into the difference graph"} />

                <h3> Graph Legend </h3>
                <p>
                    You can open a legend for the graph by dragging and dropping
                    the "Legend" text into the workspace.
                </p>
                <img src={DragAndDropDifferenceGraphLegend} alt={"gif of dragging and dropping a legend for the graph into the workspace"} />

                <h3> Editing the Graph </h3>
                <p>
                    You can edit the graph using the {goTo(PopupHelpPage.GraphOptionPanel)} panel.
                </p>
            </div>
        </div>;
    } else if (params.page === PopupHelpPage.UmapGraphOptionPanel) { 
        return <div>
            <h1 className={HELP_TITLE}>UMAP Graph Option Panel</h1>
            {homePageLink()}
            <div className={HELP_BODY}>
                <p> This is the panel contains all the information about UMAP graphs. </p>

                <h3> Create a UMAP Graph Panel </h3>
                <p>
                    You can drag-and-drop the "New UMAP Graph" button to create
                    a new UMAP Graph Panel.
                </p>
                <img src={UmapOption_CreateUmap}/>

                <h3> Control the settings of the selected UMAP Graph Panel </h3>
                <ul>
                    <li>type the name in the text input field next to "Name" and press "enter" key to change the name of the UMAP Graph</li>
                    <li>click on "Background Color" or "Axis Color" and then click on the color map to change the background color and the axis color (border color)</li>
                    <img src={UmapOption_ChangeColor}/>
                    <li>drag the slide bar to change the line width of the curves shown in the graph</li>
                    <img src={UmapOption_ChangeLineWidth}/>
                    <li>drag the slide bar to change the three parameters (number of neighbors, minimum distance, and spread) in order to create a UMAP</li>
                    <img src={UmapOption_ChangeParams}/>
                </ul>
            </div>
        </div>;
    } else if (params.page === PopupHelpPage.UmapGraphPanel) { 
        return <div>
            <h1 className={HELP_TITLE}>UMAP Graph Panel</h1>
            {homePageLink()}
            <div className={HELP_BODY}>
                <p>Panels of this type display the curves generated by a {goTo(PopupHelpPage.Umap)}.</p>

                <h3> Add a line</h3>
                <p>
                    You can add a line by clicking and draging a robot (not
                    robot part) from the {goTo(PopupHelpPage.SelectionPanel)} panel. 
                    Normally it takes a few seconds to calculate and
                    display the line.
                </p>
                <img src={Umap_AddLine}/>

                <h3> Open a legend </h3>
                <p>Click and drag the legend button to create a legend panel for this UMAP Graph Panel</p>
                <img src={Umap_OpenLegend}/>
            </div>
        </div>;
    } else if (params.page === PopupHelpPage.SceneOptionPanel) { 
        return <div>
            <h1 className={HELP_TITLE}>Scene Options Panel</h1>
            {homePageLink()}
            <div className={HELP_BODY}>
                <p> This panel is used to edit the current scene. </p>

                <h3> Selecting the Scene to Edit </h3>
                <p>
                    To edit a scene, you must first select one. To do so,
                    click on a view of the scene you would like to edit.
                    You will know that you have selected the scene when the view
                    of it that you clicked is outlined. If possible, the {goTo(PopupHelpPage.SceneOptionPanel)} panel 
                    will also be switched to automatically.
                </p>
                <img src={ClickingOnSceneToSelectIt} alt={"gif of selecting a scene"} />

                <h3> Editing the Scene </h3>
                <p>
                    To edit the scene, use the buttons in the
                    {goTo(PopupHelpPage.SceneOptionPanel)} panel.
                    They allow you to synchronize all views so that they have
                    the same position/rotations, change the view, show and/or
                    hide the ground plane, change the directional lighting,
                    edit the sizes of traces, time warp the scene relative to
                    another scene, and replace animations in the scene.
                </p>
                <img src={SceneOptionsEditingScene} alt={"gif of editing the scene using the \"Scene Options\" panel"} />

                <h3> The Scene Legend </h3>
                <p>
                    The "legend" of a scene allows you to both see what traces
                    are currently shown in a scene and to delete said traces at will.
                </p>
                <p>
                    You can open the current scene's legend by clicking and
                    dragging the "Legend" button into the workspace.
                </p>
                <img src={SceneLegendAndDeletionOfTraces} alt={"gif of a scene's legend being created and then used to delete the traces in the scene"} />
            </div>
        </div>;
    } else if (params.page === PopupHelpPage.LoadAndSavePanel) {
        return <div>
            <h1 className={HELP_TITLE}>Files Panel</h1>
            {homePageLink()}
            <div className={HELP_BODY}>
                <h3> Uploading and Downloading Workspaces </h3>
                <p>
                    This panel is used to load and/or save entire workspaces
                    (including the current layout) as well as load objects and
                    animations into the currently-selected scene.
                </p>
                <p>
                    You can upload a workspace by either by using a raw
                    URL to the json file or by uploading it from a local file.
                    You can also download the current workspace by clicking the
                    "Download" button.
                </p>
                <img src={LS_Workspace} alt="gif of loading and saving the workspace"/>

                <p>
                    If you would like to load a robot or object into the current
                    scene, you can do so by either selecting an example robot in
                    the robot dropdown and clicking "Confirm" or by uploading
                    one from a URL. Uploaded robots and/or objects can be in
                    either the ".glb" or ".urdf" format.
                </p>
                <img src={LooadingInExampleRobot} alt="gif of loading an example robot into the current scene"/>

                <p>
                    Once you have objects loaded into the current scene, you can
                    add animations to them via the "Load motion data" section of
                    the {goTo(PopupHelpPage.LoadAndSavePanel)} panel.
                </p>
                <p>
                    Robot motions must be in a special CSV format to work. If you
                    would like to learn more about motions and what the CSV
                    format looks like, go {goTo(PopupHelpPage.AnimationCSV, "here")}.
                </p>
            </div>
        </div>;
    } else if (params.page === PopupHelpPage.LegendPanel) {
        return <div>
            <h1 className={HELP_TITLE}>Legend Panel</h1>
            {homePageLink()}
            <div className={HELP_BODY}>
                <p>
                    Panels of this type are used to display the legend of
                    whatever graph panel they came from.
                </p>

                <h3> Graph Panels </h3>
                <ul>
                    <li> {goTo(PopupHelpPage.GraphPanel)} </li>
                    <li> {goTo(PopupHelpPage.DifferenceGraphPanel)} </li>
                    <li> {goTo(PopupHelpPage.UmapGraphPanel)} </li>
                    <li> {goTo(PopupHelpPage.TimeWarpedGraphPanel)} </li>
                </ul>
            </div>
        </div>;
    } else if (params.page === PopupHelpPage.TimeWarpedGraphPanel) {
        return <div>
            <h1 className={HELP_TITLE}>Timewarped Graph Panel</h1>
            {homePageLink()}
            <div className={HELP_BODY}>
                <p>
                    Panels of this type are like a
                    {goTo(PopupHelpPage.GraphPanel)} but for timewarped data.
                </p>
            </div>
        </div>;
    } else if (params.page === PopupHelpPage.RobotOptionPanel) {
        return <div>
            <h1 className={HELP_TITLE}>Robot Options Panel</h1>
            {homePageLink()}
            <div className={HELP_BODY}>
                <p>
                    This panel allows you to edit some aspects of the
                    currently-selected robot.
                </p>

                <h3> Selecting a Robot </h3>
                <p>
                    The easiest way to select an object is for you to first
                    find/open a view of the scene with the object that you would
                    like to select and then for you to click on said object.
                    When an object is successfully selected, it will become
                    highlighted in blue (which may or may not be difficult to
                    see depending on the colors/textures of the robot). If
                    possible, the {goTo(PopupHelpPage.RobotOptionPanel)} panel
                    will also be switched to upon selection.
                </p>
                <img src={SelectingRobotByClickingOnIt} alt="gif of a robot being selected by clicking on it" />
                <p>
                    For the purposes of this application, a robot is simply an
                    object. The object may or may not have joints, but you can
                    select it and manipulate it all the same. As such, to select
                    a robot you can use the {goTo(PopupHelpPage.SelectionPanel)} panel 
                    and select what its help page refers to as an object.
                </p>
                <img src={SelectingRobotViaSelectionPanel} alt="gif of selection panel being used to select the robot" />

                <h3> Editing a Robot </h3>
                <p>
                    A selected robot can be edited via the {goTo(PopupHelpPage.RobotOptionPanel)} panel.
                </p>
                <p>
                    This panel allows you to edit the opacity of the robot and
                    the position/rotation/scale of the robot. It also
                    allows you to view any animation data that is animating the
                    robot.
                </p>
                <img src={RobotOptionsRobotEditing} alt="gif of a robot being edited using the Robot Options panel" />
            </div>
        </div>;
    } else if (params.page === PopupHelpPage.QSceneOptionPanel) {
        return <div>
            <h1 className={HELP_TITLE}>Quaternion Options Panel</h1>
            {homePageLink()}
            <div className={HELP_BODY}>
                <p> This is the panel contains all the information about Quaternion Space Scene. </p>

                <h3> Create a {goTo(PopupHelpPage.Qscene)} Panel </h3>
                <p>
                    You can drag-and-drop the "New Quaternion Space" button to create
                    a new Quaternion Space Scene Panel.
                </p>
                <img src={QScene_CreateQScene} />

                <h3> Selecting a Quaternion Space Scene to Edit </h3>
                <p>
                    To edit a scene, you must first select one. To do so,
                    click on a view of the scene you would like to edit.
                    You will know that you have selected the scene when the view
                    of it that you clicked is outlined. If possible, the {goTo(PopupHelpPage.QSceneOptionPanel)} panel 
                    will also be switched to automatically.
                </p>
                

                <h3> Editing a Quaternion Space Scene </h3>
                <p>
                    To edit the scene, use the buttons in the {goTo(PopupHelpPage.QSceneOptionPanel)} panel.
                    They allow you to show/hide the world frame, change the opacity and color of the longitude
                    and latitude lines displayed on the sphere, and change the background color of the scene
                </p>
                <img src={QScene_ChangeSettings}/>
            </div>
        </div>;
    } else if (params.page === PopupHelpPage.Qscene) {
        return <div>
            <h1 className={HELP_TITLE}>Quaternion Space Scene</h1>
            {homePageLink()}
            <div className={HELP_BODY}>
                <p>
                    Quaternion traces are lines in 4D Euclidean space that encode an object’s orientation changes.
                </p>

                <h3> Related Pages </h3>
                <ul>
                    <li> {goTo(PopupHelpPage.QSceneOptionPanel)} </li>
                </ul>
            </div>
        </div>;
    } else if (params.page === PopupHelpPage.TimeBarPanel) {
        return <div>
            <h1 className={HELP_TITLE}>Time Bar Panel</h1>
            {homePageLink()}
            <div className={HELP_BODY}>
                <h3> The Time Bar </h3>
                <p>
                    The time bar of the Time Bar panel allows you
                    to define both the start and end time of all animations as well
                    as scrub through them.
                </p>
                <img src={TimeBarBeingScrubbed} alt="gif of scrubbing the time bar" />
                <p>
                    In addition, if you would like to play, pause, or restart
                    the animaions, you can do so using the buttons on this
                    panel.
                </p>
                <img src={TimeBarBeingPlayedPausedReset} alt="gif of playing, stopping, and resetting the animations via the time bar" />
            </div>
        </div>;
    } else if (params.page === PopupHelpPage.WarpedTimeBarPanel) {
        return <div>
            <h1 className={HELP_TITLE}>Time Warped Time Bar Panel</h1>
            {homePageLink()}
            <div className={HELP_BODY}>
                <p> Panels of this type are similar to the {goTo(PopupHelpPage.TimeBarPanel)} panel but contain two extra time bar options.  These extra options are specifically meant to help visualize {goTo(PopupHelpPage.TimeWarping, "time warping")} and can be switched to via the drop-down menu next to the currently-shown time bar. </p>

                <h3> The Default Time Bar </h3>
                <p>
                    This time bar works exactly the same as the one in the
                    {goTo(PopupHelpPage.TimeBarPanel)} panel so it will not
                    be further explained here.
                </p>

                <h3> Colored Time Bar </h3>
                <p>
                    This time bar has all the abilities that the default
                    time bar has but also displays where the target scene of the
                    time warping was slowed or sped up via colors.
                    Blue means that it was slowed and red means that it was sped up.
                    White means that it was unchanged.
                </p>
                <img src={ColoredTimeBarInUse} alt="gif of playing, stopping, and resetting the animations via the colored time bar" />

                <h3> Double Time Bar </h3>
                <p>
                    The double time bar, as its name suggests, consists of
                    two time bars -- one for the base scene and one for the
                    target scene -- as well as the mapping between them. The
                    mapping shows, generally, what each time in the base scene
                    is mapped to in the target scene. We say "generally"
                    because it actually only shows a small number of the
                    actual number of mappings there are (otherwise the
                    mapping area becomes too cluttered to be
                    useful), but it is enough to get a good idea of what the
                    mapping looks like.
                </p>
                <img src={DoubleTimeBarPlaying} alt="gif of the double time bars while the animations are playing" />
                <p>
                    Also of note is the fact that both time bars are
                    accurate for their respective scenes so you can scrub
                    around the target scene or base scene as you desire.
                </p>
                <img src={DoubleTimeBarBeingScrubbed} alt="gif of the base and target scene time bars being scrubbed" />
            </div>
        </div>;
    } else if (params.page === PopupHelpPage.TimeWarping) {
        return <div>
            <h1 className={HELP_TITLE}>Time Warping</h1>
            {homePageLink()}
            <div className={HELP_BODY}>
                <p>
                    Time warping takes certain aspects (joint positions, joint
                    angles, object position, etc.) of two objects in two
                    different scenes and time warps the scenes in order to best
                    match the values of those aspects over the course of their
                    animations. This is useful if, for example, you have
                    two scenes with the same general motion but one had its
                    events happen much slower than the other such that their
                    corresponding events happened seconds apart. This offset
                    makes it very difficult to juxtapose the animations as
                    their relevant events happen seconds apart, but time warping
                    can be used to ameliorate this and make their relevant events
                    happen at the same time.
                </p>
            </div>
        </div>;
    } else if (params.page === PopupHelpPage.Umap) {
        return <div>
            <h1 className={HELP_TITLE}>Legend Panel</h1>
            {homePageLink()}
            <div className={HELP_BODY}>
                <p>
                    UMAP stands for Uniform Manifold Approximation and Projection and is a
                    dimension reduction technique that can be used for
                    visualisation similarly to t-SNE, but also for general
                    non-linear dimension reduction.
                </p>

                <h3> Related Pages </h3>
                <ul>
                    <li> {goTo(PopupHelpPage.UmapGraphOptionPanel)} </li>
                    <li> {goTo(PopupHelpPage.UmapGraphPanel)} </li>
                </ul>
            </div>
        </div>;
    } else if (params.page === PopupHelpPage.AnimationCSV) {
        return <div>
            <h1 className={HELP_TITLE}>Animation CSV Format</h1>
            {homePageLink()}
            <div className={HELP_BODY}>
                <p>
                    This application compares "robot motions". A "robot motion"
                    is simply an object moving over time. To make an object move
                    over time, the application must know what
                    positions/angles/etc. an object has over time. To give it
                    this information, we give it an "animation" in the form of
                    an "animation CSV".
                </p>
                <p>
                    Each "animation CSV" starts off with a row of column names
                    and then a number of rows of column values, each value
                    meaning something different depending on what its column's
                    name is. For example, one of the columns must always be the
                    "time" column, which gives the time stamp of each row. Then
                    the other columns can manipulate positions, rotations, or
                    any other features of an object that can be animated and the
                    application will make sure that they are set to their given
                    values at the given time stamp. In this way, every row
                    (besides the first row which consists of column names) acts
                    as a "frame" of the animation.
                </p>

                <h3> Animation CSV Format </h3>
                <p>
                    Each CSV must start with 1 row of column names (strings) and
                    then 1 or more rows of column values (floats or integers).
                </p>
                <p>
                    Each column name selects one attribute of one object and
                    manipulates it over time (each row is a "frame" of the
                    animation).
                </p>
                <p>
                    As such, there must be a "time" column that has the time in
                    either seconds, milliseconds, microseconds, or nanoseconds.
                    The unit is inferred based on the ending time in the CSV.
                </p>

                <table>
                    <tr><td>seconds</td><td>by default</td></tr>
                    <tr><td>milliseconds</td><td>if the total time is &gt; 1000</td></tr>
                    <tr><td>microseconds</td><td>if the total time is &gt; 1000000</td></tr>
                    <tr><td>nanoseconds</td><td>if the total time is &gt; 1000000000</td></tr>
                </table>
                <br></br>
                <p>
                    The time column must be increasing as you go down the CSV,
                    but the first time stamp does not have to be at time 0 (it
                    can be -1234.5, 12.3, etc.).
                </p>

                <p>
                    The animation CSV also has special column names to select
                    different attributes of an object and animate them over
                    time:
                </p>

                <ul>
                    <li> Position: "X_POS", "Y_POS", "Z_POS" </li>
                    <ul>
                        <li> Used to select and animate the (x, y, z) position of an object. </li>
                        <li> Expected values are between -10.0 and 10.0 inclusive. </li>
                    </ul>
                </ul>

                <ul>
                    <li> Rotation: "X_ROT", "Y_ROT", "Z_ROT", "W_ROT" </li>
                    <ul>
                        <li> Used to select and affect the (x, y, z) euler rotation of an object. </li>
                        <li> If "W_ROT" is present, then it actually animates the (x, y, z, w) quaternion rotation of an object. </li>
                        <li> All values should be in radians. </li>
                    </ul>
                </ul>

                <ul>
                    <li> Scale: "X_SCALE", "Y_SCALE", "Z_SCALE" </li>
                    <ul>
                        <li> Used to select and affect the (x, y, z) scale of an object. </li>
                        <li> Values can be anything you want but keep in mind that the expected viewing area is a 10 by 10 by 10 cube so making the scale larger than 10 is going to make it take up the entire screen. </li>
                    </ul>
                </ul>

                <p>
                    Other than the "time" column, every other column name should
                    start with the name of the object it is selecting (found in
                    the "[Select Object](SelectObjectTab)" tab.) and then (if
                    the column is for one of the special attributes listed
                    above) the attribute selector (listed above) should be
                    appended to the column name.
                </p>

                <p>
                    If anything other than an attribute selector is appended to
                    the URDF name, it is assumed to be the name of the joint on
                    the URDF that the column is selecting.
                </p>

                <p>
                    Valid column names can be composed of any number of
                    alphanumeric characters
                    ("abcdefghigklmnopqrstuvwxyzABCDEFGHIGKLMNOPQRSTUVWXYZ0123456789")
                    or underscores ("_").
                </p>

                <p>
                    Additionally, you are allowed to use a hyphen "-" to
                    seperate the object name from the
                    position/rotation/scale/joint selector.
                </p>

                <h3> Example </h3>
                <p>
                    Below is an example animation CSV that you could put in a file and load directly into the application (there are explanations of its columns beneath it as well as a repeat of the CSV in a more readable format).
                </p>

                <table>
                    <tr><th>time</th><th>ik_solutions-right_j0</th><th>ik_solutions-right_j1</th><th>ik_solutions-X_POS</th><th>ik_solutions-Y_POS</th><th>ik_solutions-Z_POS</th></tr>
                    <tr><td>0.03330000000000003</td><td>1.1204203532251877</td><td>0.21976057475879832</td><td>-0.5517561517071136</td><td>1.5517561462</td><td>-2.1240893</td></tr>
                    <tr><td>0.50381920383039</td><td>1.8204203732251877</td><td>0.21973057475879832</td><td>-0.35123049822136</td><td>1.5517561462</td><td>-2.1240893</td></tr>
                    <tr><td>0.98992327397899</td><td>1.8204203732251877</td><td>0.21973057475879832</td><td>-0.35123049822136</td><td>1.5517561462</td><td>-2.1240893</td></tr>
                    <tr><td>1.12309487213904</td><td>1.8204203732251877</td><td>0.21973057475879832</td><td>-0.35123049822136</td><td>1.5517561462</td><td>-2.1240893</td></tr>
                    <tr><td>1.33091873829083</td><td>1.8204203732251877</td><td>0.21973057475879832</td><td>-0.35123049822136</td><td>1.5517561462</td><td>-2.1240893</td></tr>
                    <tr><td>1.43091283743249</td><td>1.8204203732251877</td><td>0.21973057475879832</td><td>-0.35123049822136</td><td>1.5517561462</td><td>-2.1240893</td></tr>
                </table>

                <h4> Column Explanations: </h4>
                <ul>
                    <li>"time"</li>
                    <ul><li>Tells the time stamp of each row.</li></ul>
                    <li>"ik_solutions-right_j0"</li>
                    <ul><li>Since this column's name does not possess any of the special column names, this column selects the "right_j0" joint of an object named "ik_solutions" and animates its angle.</li></ul>

                    <li>ik_solutions-right_j1</li>
                    <ul><li>Selects and animates the angle of a joint named "right_j1" on an object named "ik_solutions".</li></ul>

                    <li>ik_solutions-X_POS</li>
                    <ul><li>Animates the x-position of an object named "ik_solutions"</li></ul>

                    <li>ik_solutions-Y_POS</li>
                    <ul><li>Animates the y-position of an object named "ik_solutions"</li></ul>

                    <li>ik_solutions-Z_POS</li>
                    <ul><li>Animates the z-position of an object named "ik_solutions"</li></ul>
                </ul>

                <p>
                    Below is the same CSV as above but in a more readable format.
                </p>
            </div>
        </div>;

    // --- Loading Popups ---
    } else if (params.page === PopupHelpPage.LoadingStarted) {
        return <div className="LoadingMessage">
            <p>{params.type === "UMAP" ? "Calculating" : "Loading"} {(params.type ? `${params.type}` : null)} {/*(params.location ? `from ${params.location}` : null)*/}. Please wait a few seconds...</p>
        </div>;
    } else if (params.page === PopupHelpPage.LoadingSuccess) {
        return null; // just close the popup
    } else if (params.page === PopupHelpPage.LoadingFailed) {
        return <div className="LoadingFailed">
            <p>Failed to load {(params.type ? `${params.type}` : null)} {(params.location ? `from ${params.location}` : null)}.</p>
            {/*(params.error ? <p>Error: {params.error}.</p> : null)*/}
        </div>;

    // --- Page Error Popups
    } else if (params.page === PopupHelpPage.PageNotFound) {
        return <div>
            <h1>Page Not Found</h1>
            <p>{goTo(PopupHelpPage.Home)}</p>
            <p>The page named "{(params.pageName ? params.pageName : params.page)}" could not be found.</p>
        </div>;
    }

    // popup the `PageNotFound` page with the current page
    return popupHelpPageContent({
        page: PopupHelpPage.PageNotFound,
        pageName: params.page
    });
}
