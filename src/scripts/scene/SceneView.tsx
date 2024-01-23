import T from "../true_three";

/**
 * A class to encapsulate the view of a scene. Note that the scene is not added
 * to this view, that is because you must either register this SceneView with a 
 * ThreeScene or draw the ThreeScene to the SceneView to actually make
 * the scene be drawn to this SceneView's canvas from the perspective of this
 * SceneView's Camera. This allows you to have multiple views of the same scene
 * displayed at once.
 */
export class SceneView {
    protected _canvas:HTMLCanvasElement;
    protected _camera:T.Camera;
    protected _preprocess:  (canvas: HTMLCanvasElement) => void;
    protected _postprocess: (canvas: HTMLCanvasElement) => void;

    constructor(
            canvas:HTMLCanvasElement,
            camera:T.Camera,
            preprocess: ((canvas: HTMLCanvasElement) => void) = (() => {}),
            postprocess:((canvas: HTMLCanvasElement) => void) = (() => {}),
        ) {
        this._canvas = canvas;
        this._camera = camera;
        this._preprocess = preprocess;
        this._postprocess = postprocess
    }

    canvas():HTMLCanvasElement {
        return this._canvas;
    }

    camera():T.Camera {
        return this._camera;
    }

    preprocess() {
        this._preprocess(this._canvas);
    }

    postprocess() {
        this._postprocess(this._canvas);
    }
}