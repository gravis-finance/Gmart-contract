let empty = false;
async function loop(Class, method, msNormal = 10, msEmpty = 10000, msError = 2000) {
  let ms = msNormal;
  try {
    // if (empty) console.clear();

    const res = await Class[method]();
    if (!res) {
      ms = msEmpty;
      // console.inline(method, 'wait..');
      empty = true;
    }
    else {
      empty = false;
    }
  }
  catch (err) {
    console.error(err);
    ms = msError;
  }

  setTimeout(() => loop(Class, method, ms, msEmpty), ms);
}

module.exports = loop;