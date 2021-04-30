/**
 * The type of data returned by agify.io
 * @typedef {Object} AgeObject
 * @property {string} AgeObject.name
 * @property {number} AgeObject.age
 * @property {number} AgeObject.count
 */

const SORT_TYPES = {
  NAME: 'name',
  AGE: 'age'
};

let sortType = SORT_TYPES.NAME;

/**
 * exposes the functions for interacting with the persisted list of age data
 */
function createAgeStorage(localStorageInstance = window.localStorage) {
  const STORAGE_STRING = 'agify-list';

  /**
   * retrieve the list of items
   * @returns {Array<AgeObject>}
   */
  function loadAges() {
    const listFromStorage = localStorageInstance.getItem(STORAGE_STRING);
    let listAsJson = [];
    // easy defensive case, parsing is a little more concerning than stringifying
    try {
      listAsJson = JSON.parse(listFromStorage);
    } catch (err) {
      console.error('error parsing ages from localstorage', err);
      listAsJson = [];
    }
    if (Array.isArray(listAsJson)) {
      return listAsJson;
    }
    return [];
  }

  /**
   * add an item
   * @param {Object} age
   */
  function addAge(age) {
    const currentList = loadAges();
    currentList.push(age);

    // AC: only display latest 9, so only every save at most 9
    const latestNine = currentList.slice(-9);
    localStorageInstance.setItem(STORAGE_STRING, JSON.stringify(latestNine));
  }

  /**
   * remove an item by index
   * @param {number} index
   */
  function removeAge(index) {
    const currentList = loadAges();
    currentList.splice(index, 1);
    localStorageInstance.setItem(STORAGE_STRING, JSON.stringify(currentList));
  }

  return {
    loadAges,
    addAge,
    removeAge,
  };
}

/**
 * Retrieve the age estimate for a given name from agify.io
 * @param {string} name
 * @returns {Promise<AgeObject>}
 */
function agifyNameSearch(name) {
  return fetch(`https://api.agify.io?name=${name}`).then((response) =>
    response.json()
  );
}

/**
 * builds html for a single age datum
 * @param {AgeObject} item
 * @returns {string}
 */
function renderItem(item, index) {
  return `
    <div class="age-item">
      <div class="flex col space-between h-100">
        <div class="flex space-between">
          <span class="age-item-name">${item.name}</span>
          <span class="age-item-close" data-index="${index}">&#10006</span>
        </div>
        <div class="age-item-age flex center">${item.age}</div>
        <div class="age-item-count flex center">
          <span>Sample Size ${item.count}
        </div>
      </div>
    </div>
  `;
}

/**
 * loads the age data from storage, then builds html and sets innerHtml of the container
 * @param {Object} localStorageInstance
 */
function renderAges(storage) {
  const agesArray = storage.loadAges();

  if (!Array.isArray(agesArray)) {
    console.error(
      `tried to render something that's not an array, got ${agesArray}`
    );
    return;
  }

  const element = document.getElementById('agesContainer');
  if (!element) {
    return;
  }
  const content = agesArray
    .sort((ageA, ageB) => {
      if (sortType === SORT_TYPES.COUNT) {
        return ageA.count - ageB.count;
      } else if (sortType === SORT_TYPES.AGE) {
        return ageA.age - ageB.age;
      }
    })
    .map((item, index) => renderItem(item, index))
    .join('');
  element.innerHTML = `<div class="flex row age-list">${content}</div>`;

  // add click listeners for close buttons
  const closeButtons = document.getElementsByClassName('age-item-close');
  for (let i = 0; i < closeButtons.length; i++) {
    const close = closeButtons.item(i);
    function onRemove(event) {
      const indexToRemove = parseInt(event.target.dataset.index, 10);
      storage.removeAge(indexToRemove);
      close.removeEventListener('click', onRemove);
      renderAges(storage);
    }
    close.addEventListener('click', onRemove);
  }
}

/**
 * initialize the event listeners for the given text input, button, and form
 *
 * @param {string} btnId
 * @param {string} inputId
 * @param {string} formId
 * @param {Function} onSearch
 */
function listenForSearch(btnId, inputId, formId, onSearch) {
  const button = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  const form = document.getElementById(formId);

  const handleOnSearch = (event) => {
    event.preventDefault();
    const name = input.value;
    if (!name) {
      return;
    }
    if (typeof onSearch === 'function') {
      onSearch(name);
    }
  };

  button.addEventListener('click', handleOnSearch);
  form.addEventListener('submit', handleOnSearch);
}

function isValidAge(age) {
  return !!age && !!age.name && !!age.count;
}

function doesNameExist(storage, name) {
  const lowerCaseName = name.toLowerCase();
  const currentAgeData =  storage.loadAges();
  const dataForName = currentAgeData.find((age) => age.name.toLowerCase() === lowerCaseName);
  return !!dataForName;
}

function listenForSortChanges(storage) {
  const sortSelectElement = document.getElementById('sortSelect');
  sortSelectElement.addEventListener('change', (event) => {
    const { value } = event.target;
    sortType = value;
    renderAges(storage);
  });
}

// on startup
const storage = createAgeStorage(window.localStorage);
renderAges(storage);
listenForSortChanges(storage);
listenForSearch('searchBtn', 'nameInput', 'ageForm', (nameToSearch) => {

  // Don't search or add duplicates
  const nameExists = doesNameExist(storage, nameToSearch);
  if (nameExists) {
    alert(`Already have data for '${nameToSearch}'`);
    return;
  }

  agifyNameSearch(nameToSearch)
    .then((age) => {

      // don't add entries that have invalid data
      if (!isValidAge(age)) {
        alert(`Found no data for '${nameToSearch}'`);
        return;
      }

      storage.addAge(age);
      renderAges(storage);
    })
    .catch((error) => {
      alert(`Encountered an error searching for '${nameToSearch}'`);
    });
});
