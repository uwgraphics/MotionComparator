import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import T from './true_three';

/**
 * Saves the given data to a local file of the given filename.
 * Source: https://stackoverflow.com/questions/45611674/export-2d-javascript-array-to-excel-sheet
 * @param data The data to save.
 * @param filename The name of the file to save to.
 */
export function saveToCSV(data:string[][], filename:string) {
    let str = "";
    data.forEach((row) => {
        for (let i = 0; i < row.length - 1; i++) {
            str += row[i] + ",";
        }
        str += row[row.length - 1] + "\r\n";
    });
    str = "data:application/csv," + encodeURIComponent(str);
    let x = document.createElement("A");
    x.setAttribute("href", str);
    x.setAttribute("download", filename);
    document.body.appendChild(x);
    x.click();
    document.body.removeChild(x);
}


/**
 * Saves the given data to a local .json file.
 * @param data The data to save.
 * @param filename The file to save the data to.
 */
export function saveToJson(data:object | string | number | boolean, filename:string, indent?:number) {
    console.log(data);
    if (!filename.endsWith('.json')) {
        filename += '.json';
    }
    if (data instanceof Object) {
        data = JSON.stringify(data, undefined, indent);
    }
    let str = "data:application/json;charset=utf-8," + encodeURIComponent(data);
    let x = document.createElement("A");
    x.setAttribute("href", str);
    x.setAttribute("download", filename);
    document.body.appendChild(x);
    x.click();
    document.body.removeChild(x);
}


/**
 * Saves the given Three.scene to a GTLF file.
 * @param scene The scene to save.
 * @param filename The name of the file to save to.
 */
export function saveSceneToGLTF(scene:T.Scene, filename:string='scene.gltf') {
    if (!filename.endsWith('.gltf')) {
        filename += '.gltf';
    }

    let link = document.createElement( 'a' );
    document.body.appendChild( link );
    let exporter = new GLTFExporter();

    let options = {
        trs: false,
        onlyVisible: true,
        truncateDrawRange: false,
        binary: false,
        forceIndices: true,
        maxTextureSize: Infinity // To prevent NaN value
    }

    // https://github.com/mrdoob/three.js/blob/master/examples/misc_exporter_gltf.html
    let save = (blob:Blob, filename:string) => {
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }

    let saveString = (text:string, filename:string) => {
        save(new Blob([text], { type: 'text/plain' }), filename);
    }

    let saveArrayBuffer = (buffer:ArrayBuffer, filename:string) => {
        save(new Blob([buffer], { type: 'application/octet-stream' }), filename);
    }

    exporter.parse(scene, function (result) {
        if (result instanceof ArrayBuffer) {
            saveArrayBuffer(result, 'scene.glb');
        } else {
            let output = JSON.stringify(result, null, 2);
            saveString(output, filename);
        }
    }, options);
}


