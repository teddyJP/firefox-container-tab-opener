const urlInput = document.getElementById("url");
const tabCountInput = document.getElementById("tabCount");
const openButton = document.getElementById("openButton");

const containerStatus =
    document.getElementById("containerStatus");

const containerList =
    document.getElementById("containerList");

const message =
    document.getElementById("message");


let containers = [];


/*
    Natural sorting means:

    Account 1
    Account 2
    Account 3
    ...
    Account 10

    instead of:

    Account 1
    Account 10
    Account 11
    Account 2
*/
function naturalSort(a, b) {

    return a.name.localeCompare(
        b.name,
        undefined,
        {
            numeric: true,
            sensitivity: "base"
        }
    );
}


/*
    Show error or success messages.
*/
function showMessage(text, type = "") {

    message.textContent = text;

    message.className = "message";

    if (type) {
        message.classList.add(type);
    }
}


/*
    Make sure the user's URL is usable.
*/
function normalizeUrl(input) {

    let url = input.trim();

    if (!url) {
        throw new Error(
            "Please enter a website."
        );
    }


    /*
        Allow the user to type:

        google.com

        instead of requiring:

        https://google.com
    */
    if (
        !url.startsWith("http://") &&
        !url.startsWith("https://")
    ) {
        url = "https://" + url;
    }


    let parsedUrl;

    try {

        parsedUrl = new URL(url);

    } catch {

        throw new Error(
            "The website URL is invalid."
        );
    }


    /*
        Only allow normal web URLs.
    */
    if (
        parsedUrl.protocol !== "http:" &&
        parsedUrl.protocol !== "https:"
    ) {

        throw new Error(
            "Only HTTP and HTTPS websites are supported."
        );
    }


    return parsedUrl.href;
}


/*
    Read Firefox containers.

    These are the containers that already exist under:

    about:preferences#containers
*/
async function loadContainers() {

    try {

        containers =
            await browser.contextualIdentities.query({});


        /*
            Sort names naturally.

            Example:

            Container 1
            Container 2
            Container 3
            ...
            Container 30
        */
        containers.sort(naturalSort);


        if (containers.length === 0) {

            containerStatus.textContent =
                "No Firefox containers found.";

            openButton.disabled = true;

            return;
        }


        containerStatus.textContent =
            `${containers.length} Firefox containers detected.`;


        /*
            Default to opening every available container.
        */
        tabCountInput.value =
            containers.length;


        /*
            Maximum allowed number of tabs =
            number of containers.
        */
        tabCountInput.max =
            containers.length;


        updateContainerPreview();


    } catch (error) {

        console.error(error);

        containerStatus.textContent =
            "Unable to access Firefox containers.";

        showMessage(
            "Make sure Firefox Container Tabs are enabled.",
            "error"
        );

        openButton.disabled = true;
    }
}


/*
    Show exactly which containers will be used.
*/
function updateContainerPreview() {

    containerList.innerHTML = "";


    const requestedCount =
        Number.parseInt(
            tabCountInput.value,
            10
        ) || 0;


    containers.forEach(
        (container, index) => {

            const item =
                document.createElement("div");

            item.className =
                "container-item";


            /*
                Fade containers that won't be used.
            */
            if (index >= requestedCount) {

                item.classList.add(
                    "container-unused"
                );
            }


            const number =
                document.createElement("span");

            number.className =
                "container-number";

            number.textContent =
                `${index + 1}.`;


            const name =
                document.createElement("span");

            name.className =
                "container-name";

            name.textContent =
                container.name;


            item.appendChild(number);
            item.appendChild(name);

            containerList.appendChild(item);
        }
    );
}


/*
    Validate the requested tab count.
*/
function validateTabCount() {

    const raw =
        tabCountInput.value.trim();


    if (!raw) {

        throw new Error(
            "Enter the number of tabs you want to open."
        );
    }


    const count =
        Number(raw);


    if (!Number.isInteger(count)) {

        throw new Error(
            "Tab count must be a whole number."
        );
    }


    if (count < 1) {

        throw new Error(
            "Tab count must be at least 1."
        );
    }


    /*
        IMPORTANT SAFETY CHECK

        Nothing opens if more tabs are requested
        than containers available.
    */
    if (count > containers.length) {

        throw new Error(
            `You requested ${count} tabs, but only ` +
            `${containers.length} Firefox containers exist.`
        );
    }


    return count;
}


/*
    Small delay between tab creations.

    This prevents Firefox from being hit with
    dozens of tab creation calls in exactly
    the same millisecond.
*/
function sleep(milliseconds) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );
}


/*
    Open tabs.
*/
async function openTabs() {

    showMessage("");


    try {

        /*
            Validate everything BEFORE opening
            even one tab.
        */

        const url =
            normalizeUrl(
                urlInput.value
            );


        const tabCount =
            validateTabCount();


        const selectedContainers =
            containers.slice(
                0,
                tabCount
            );


        openButton.disabled = true;

        openButton.textContent =
            "Opening Tabs...";


        let openedCount = 0;


        /*
            Each container has its own
            cookieStoreId.

            Creating the tab with that ID
            places the new tab in that
            Firefox container.
        */
        for (
            const container
            of selectedContainers
        ) {

            await browser.tabs.create({

                url: url,

                cookieStoreId:
                    container.cookieStoreId,

                /*
                    Keep the popup / existing
                    tab active while the rest
                    open in the background.
                */
                active: false

            });


            openedCount++;


            openButton.textContent =
                `Opening ${openedCount}/${tabCount}...`;


            /*
                75ms between tabs.

                You can lower this if desired.
            */
            await sleep(75);
        }


        showMessage(
            `Successfully opened ${openedCount} tabs ` +
            `using ${openedCount} different containers.`,
            "success"
        );


    } catch (error) {

        console.error(error);

        showMessage(
            error.message,
            "error"
        );

    } finally {

        openButton.disabled = false;

        openButton.textContent =
            "Open Container Tabs";
    }
}


/*
    Update container preview when count changes.
*/
tabCountInput.addEventListener(
    "input",
    updateContainerPreview
);


/*
    Clicking the button starts everything.
*/
openButton.addEventListener(
    "click",
    openTabs
);


/*
    Allow Enter key.
*/
document.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {

            openTabs();
        }
    }
);


/*
    Load Firefox containers immediately
    when the popup opens.
*/
loadContainers();
