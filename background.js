
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



const importTabs = (fileContent) => {
    // Extract list of tabs
    const listOfTabs = fileContent.tabs;

    // Group Tabs Queue to keep track of completion of tabGroups promise.
    const groupTabsQueue = new Map();

    // Array of Promises requested.
    const groupedTabsPromiseArray = [];

    for (const tab of listOfTabs) {
        if (browserDetected == 1 || tab.groupId === undefined || tab.groupId == -1) {
            // 1. If tabs are opened in FireFox
            // 2. For Tabs which are not grouped.

            // Create new tab and log outcome.
            browserAPI.tabs
                .create({
                    url: tab.url,
                    active: false
                })
        } else {
            // Check if URL to be grouped.
            if (groupTabsQueue.has(tab.url)) {
                const getGroup = groupTabsQueue.get(tab.url);

                getGroup.set(
                    tab.groupId,
                    getGroup.has(tab.groupId) ? getGroup.get(tab.groupId) + 1 : 1
                );

                groupTabsQueue.set(tab.url, getGroup);
            } else {
                groupTabsQueue.set(tab.url, new Map([[tab.groupId, 1]]));
            }

            groupedTabsPromiseArray.push(
                // Create new tab 
                browserAPI.tabs.create({
                    url: tab.url,
                    active: false,
                })
            );
        }
    }


    const moveTabsToGroups = (metaData) => {
        metaData.forEach((group) => {
            // Create new Group with tabs listed. 
            browserAPI.tabs.group({
                tabIds: group.tabs
            })
                .then((delta) => {
                    browserAPI.tabGroups
                        .update(delta, {
                            title: group.title,
                            collapsed: true,
                        })
                });
        });

    };

    if (browserDetected == 1 || fileContent.groups === undefined) {
        // 1. If FireFox.
       
    } else {
        // Meta Data of newly created tabs to be grouped.
        const groupMetaData = new Map();

        // To check if all promised are fulfilled.
        Promise.allSettled(groupedTabsPromiseArray).then((results) => {
            results.forEach((result) => {
                // Get URL
                const url = result.value.url || result.value.pendingUrl;

                // URL to be grouped in.
                const groupsRelatedToURL = groupTabsQueue.get(url);

                // Group Id
                const groupIdForTab = groupsRelatedToURL.keys().next().value;

                const groupIdCount = groupsRelatedToURL.get(groupIdForTab);

                if (groupIdCount == 1) {
                    ((groupsRelatedToURL.size == 1) ?
                        groupTabsQueue.delete(url) :
                        groupsRelatedToURL.delete(groupIdForTab));
                } else {
                    groupsRelatedToURL.set(groupIdForTab, groupIdCount - 1);
                    groupTabsQueue.set(url, groupsRelatedToURL);
                }

                const metaData = {
                    title: fileContent.groups[groupIdForTab].title,
                };

                if (!groupMetaData.has(groupIdForTab)) {
                    metaData[`tabs`] = [result.value.id];
                } else {
                    metaData[`tabs`] = groupMetaData.get(groupIdForTab).tabs;
                    metaData.tabs.push(result.value.id);
                }

                // Set meta data for respective Group.
                groupMetaData.set(groupIdForTab, metaData);

                // Log sucessful creation of tab.
                // logErrorOrSuccess(`newTabCreated`, result.value);

                // If all promises are fulfilled then group tabs.
                if (groupTabsQueue.size == 0) {
                    moveTabsToGroups(groupMetaData);
                }
            });
        });
    }
};


const interpretRequest = (message, sender, sendResponse) => {
    // Check if requesting for import tabs functionality
    if (message.type === `imported_file_content`) {
        LoggerQueue = [];
        // saveTabsSettingsObject = message.saveTabsSettings;
        importTabs(message.data);
        sendResponse(`Request Submitted Successfully!`);
    }
};


// Listener to listen message received from saveTabs.js
browserAPI.runtime.onMessage.addListener(interpretRequest);
