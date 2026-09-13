import { getCookie } from "./GetCookie";

function postRequestOptions(body: any) {
    let jwt = getCookie('saathi-token');
    let requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + jwt },
        body: JSON.stringify(body)
    };
    return requestOptions;
}

function putRequestOptions(body: any) {
    let jwt = getCookie('saathi-token');
    let requestOptions = {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + jwt },
        body: JSON.stringify(body)
    };
    return requestOptions;
}

function getRequestOptions() {
    let jwt = getCookie('saathi-token');

    let requestOptions = {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + jwt }
    };
    return requestOptions;
}

function deleteRequestOptions() {
    let jwt = getCookie('saathi-token');

    let requestOptions = {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + jwt }
    };
    return requestOptions;
}

export { postRequestOptions, getRequestOptions, deleteRequestOptions, putRequestOptions };