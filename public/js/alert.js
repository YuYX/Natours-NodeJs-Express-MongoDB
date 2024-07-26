/* eslint-disable */

export const hideAlert = () => {
    const el = document.querySelector('.alert');
    if(el) el.parentElement.removeChild(el);
};

// type is 'success' or 'error'.
export const showAlert = (type, msg) => {
    hideAlert();

    const markup = `<div class="alert alert--${type}">${msg}</div>`;
    document.querySelector('body').insertAdjacentElement('afterbegin', markup); 
    // 'afterbegin' means inside the 'body' but placed right in the beginning.

    window.setTimeout(hideAlert, 5000);
}; 