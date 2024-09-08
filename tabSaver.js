`use strict`;


window.addEventListener('DOMContentLoaded', () => {

    //  * Firefox 1
    //  * Google Chrome	2

    let browserDetected = 1;

    // Browser's API Object.
    let browserAPI;

    try {
        // Firefox
        browserAPI = browser;
    } catch (error) {
        // Chrome
        browserDetected = 2;
        browserAPI = chrome;
    }


    const importTabsWithFilename = (filename) => {

        chrome.storage.local.get('fileDataObj', async function(result) {
            const fileDataObj = result.fileDataObj || {};

            const lastFileData = fileDataObj[filename];

            const fileContent = lastFileData

            console.log('fileCont--> ',fileContent);
    
            if (fileContent) {
                // Send Message to background.js to run creation of tabs in any group.
                browserAPI.runtime.sendMessage(
                    {
                        type: `imported_file_content`,
                        data: fileContent,
                        saveTabsSettings: null
                    },
                    (response) => {
                        try {
                            console.log(response);
                            window.close();
                        } catch (error) {
                            console.error(error);
                        }
                    }
                );
            } else {
                console.error('File data not found in storage for filename',fileContent);
            }
        });
    };
    

    function createButtons(data) {
        var container = document.getElementsByClassName("sessionItem")[0];
        container.innerHTML = '';


        const sortedFilenames = Object.entries(data)
            .sort(([, fileA], [, fileB]) => new Date(fileB.dateCreated) - new Date(fileA.dateCreated))
            .map(([filename]) => filename);

        // Iterate through the data and create a button for each filename
        for (const filename of sortedFilenames) {

            // Create the button div
            var buttonDiv = document.createElement("div");
            var button = document.createElement("button");
            button.className = "session_button";
            button.textContent = filename
            buttonDiv.appendChild(button);

            buttonDiv.addEventListener("click", function () {
                handleImportClick(filename);
            });

            // Create the download icon div
            var downloadIconDiv = document.createElement("div");
            downloadIconDiv.className = "icoz";
            var downloadIcon = document.createElement("i");
            downloadIcon.className = "fa-solid fa-download fa-xl";
            downloadIcon.title = "download";
            downloadIconDiv.appendChild(downloadIcon);
            downloadIconDiv.addEventListener("click", function () {
                handleDownloadClick(filename);
            });

            // Create the delete icon div
            var deleteIconDiv = document.createElement("div");
            deleteIconDiv.className = "icoz";
            var deleteIcon = document.createElement("i");
            deleteIcon.className = "fa-solid fa-trash fa-xl";
            deleteIcon.title = "delete";
            deleteIconDiv.appendChild(deleteIcon);
            deleteIconDiv.addEventListener("click", function () {
                handleDeleteClick(filename);
            });

            // Append the divs to the sessionItem div
            container.appendChild(buttonDiv);
            container.appendChild(downloadIconDiv);
            container.appendChild(deleteIconDiv);

        };
    }

    function handleImportClick(filename) {
        console.log("Button clicked for filename:", filename);
        importTabsWithFilename(filename);
    }

    function handleDeleteClick(filename) {
        console.log("Button clicked for filename:", filename);

        chrome.storage.local.get('fileDataObj', function (result) {
            var data = result.fileDataObj || {};
            delete data[filename];
            chrome.storage.local.set({'fileDataObj':data}, function () {
                fetchDataAndCreateButtons();
            });
        });
    }

    function handleDownloadClick(filename){
        chrome.storage.local.get('fileDataObj', async function(result) {
            const fileDataObj = result.fileDataObj || {};

            const fileContent = fileDataObj[filename];

            console.log(fileContent)

            initiateDownloadfromLocal(fileContent,filename);
        });
    }


    function fetchDataAndCreateButtons() {
        chrome.storage.local.get('fileDataObj', function (result) {
            var data = result.fileDataObj || {};
            createButtons(data);
        });

    }
    

    const getFilename = () => {
        
        const filenameElement = document.getElementById(`tabFileName`);

        const fileName = filenameElement.value
            .trim()
            .replace(/[^\w\s_\(\)\-]/gi, ``);

        if (fileName == ``) {
            // Default File Name.
            return `TabFile_${new Date()
                .toLocaleString()
                .replaceAll(/(, )| /g, "_")
                .replaceAll(/[,://]/g, "-").toUpperCase()}.json`;
        } else {
            // User Input File Name.
            return `${fileName}.json`;
        }
    };




    const initiateDownloadfromLocal = async (fileContent,fileName) => {
        // Create Blob of file content
        const file = new Blob([JSON.stringify(fileContent)], {
            type: `plain/text`
        });
        
        // Download Queue to keep track of each download event.
        const downloadQueue = new Map();
        
        // Create URL of Blob file
        const url = window.URL.createObjectURL(file);

        const filename = fileName+'.json'


        const metaData = {
            url: url,
            filename: filename,
            saveAs: true,
            conflictAction: `uniquify`
        };

  
        if (browserDetected == 1) {
            // Firefox
            browserAPI.downloads.download(metaData).then(
                (id) => {
                    downloadQueue.set(id, {
                        url,
                        filename
                    });

                });
        } else {
            // Chrome
            browserAPI.downloads.download(metaData, (id) => {
                downloadQueue.set(id, {
                    url,
                    filename
                });
            });
        }
    };


    function addFiledataToList(filename,filedata) {
        // Retrieve the current file list from local storage
        chrome.storage.local.get('fileDataObj', function(result) {
        const currentDataList = result.fileDataObj || {};
      
          // Add the new filedata to the list
        currentDataList[filename] = filedata
      
        // Update the file list in local storage
        chrome.storage.local.set({ fileDataObj: currentDataList }, function() {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
        } else {
            console.log('File data added to the list');
        }
        });
    });
    }

    
    const exportToLocal = (tabs) => {
        // Download Queue to keep track of each download event.
        const downloadQueue = new Map();

        // Group Tabs Promise Queue to keep track of completion of tabGroups promise.
        const groupTabsQueue = new Map();

        // Promise array to keep track of all promises requested.
        let promiseArray = [];

        const currentDate = new Date();

        // Structure of file which will be downloaded
        let fileContent = Object({
            tabs: [],
            dateCreated: currentDate.toISOString()
        });

        const storeToLocal = async (fileContent) => {
    
            // Get file name
            const fileName = getFilename();
    
            // addFileDataToList(fileName);
            const myFileName = fileName.split('.')[0]
            addFiledataToList(myFileName, fileContent)

        }


        // Restructuring tabs with required details (url and groupId)
        tabs.map((tab) => {
            if (tab.groupId === undefined || tab.groupId == -1) {
                fileContent.tabs.push({
                    url: tab.url
                });
            } else {
                fileContent.tabs.push({
                    url: tab.url,
                    groupId: tab.groupId
                });

                if (tab.groupId != -1 && !groupTabsQueue.has(tab.groupId)) {
                    groupTabsQueue.set(tab.groupId, 1);
                    promiseArray.push(browserAPI.tabGroups.get(tab.groupId));
                }
            }
        });

        if (groupTabsQueue.size || promiseArray.length) {
            // if group details are requested
            Promise.allSettled(promiseArray).then((results) => {
                results.forEach((result) => {
                    groupTabsQueue.delete(result.value.id);

                    if (fileContent.groups === undefined) {
                        fileContent[`groups`] = {};
                    }

                    fileContent.groups[result.value.id] = {
                        title: result.value.title,
                    };

                    // If all promises are fulfilled then intiate download.
                    if (groupTabsQueue.size == 0) {
                        storeToLocal(fileContent);
                    }
                });
            });
        } else {
            // If no group details request initiated.
            storeToLocal(fileContent);
        }

        fetchDataAndCreateButtons();

    };


    const importTabs = (fileInput) => {
        // Read the data from uploaded file.
        const file = fileInput.target.files[0];

        const reader = new FileReader();
        reader.readAsText(file, `UTF-8`);
        reader.onload = (e) => {
            const fileContent = JSON.parse(e.target.result);

            // Send Message to background.js to run creation of tabs any group.
            browserAPI.runtime.sendMessage(
                {
                    type: `imported_file_content`,
                    data: fileContent
                },
                (response) => {
                    try {
                        console.log(response);
                        window.close();
                    } catch (error) {
                        console.log(error);
                    }
                }
            );
        };
    };

    const savetabs = () => {
        // Get list all tabs open in current browser window
        browserAPI.tabs
            .query({
                currentWindow: true,
            })
            .then(exportToLocal);
    };

  


    chrome.storage.onChanged.addListener(function (changes, namespace) {
        fetchDataAndCreateButtons();
    });





    const init = () => {


        document.getElementById('importbtn').addEventListener('click', function() {
            document.getElementById('jsonFile').click();
        });

        // export to local storage chorme
        document.getElementById(`savetab`).addEventListener(`click`, savetabs);
        
        // Detect if file is selected using HTML input file.
        document.getElementById(`jsonFile`).addEventListener(`change`, importTabs);
        
        
        
        fetchDataAndCreateButtons();
        
       

    };

    init();
});



