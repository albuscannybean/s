import { TEXTBOOK_CHAPTERS } from './textbook-lessons.js';

// Hashes identify the supplied editions and keep reading positions and annotations aligned.
const editions = [
  ['algebra', 219, '6786f3fe0ffca03f480b7c750cfc56c7ce8fe48a56b0d38a7bf3af90bce3be3e'],
  ['ode', 264, 'a00db4bc05af45431db5280f6770c9a7e4ef17b96e17db6bd7a99d51a64bf06a'],
  ['prob', 478, '38d1669dc1a17a993785eda98c1ecd5d9dbdcebd437b2ed46e956982a12992ee'],
  ['analysis', 358, '20196e115316f73c9f1924a2e4ad995c3a78197844ac62618f37a6dcc033c4cb'],
  ['a1', 352, '161fd5cbb444eb16f419bef729e42bcf423833ea84c4e8d977c8c8516105365d'],
  ['a2', 360, '9c974893c88b3ab061532f793a63debd6e10eeac38b0b6aa6b4736d25bc07564'],
  ['a3', 422, '78062804e5b43be07cf01caf977e03e3f732fd1fbd621d6bd89d543e5e47dbf0']
];

export const TEXTBOOK_EDITIONS = editions.map(([id, pages, sha256]) => {
  const chapters = TEXTBOOK_CHAPTERS.filter(chapter => chapter.book === id);
  return { id, pages, sha256, title: chapters[0].source, chapters };
});

export const textbookForSource = source => TEXTBOOK_EDITIONS.find(book => book.title === source?.book);

