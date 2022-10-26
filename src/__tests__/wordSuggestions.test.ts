import {
  forEach,
  forIn,
  isEqual,
} from 'lodash';
import {
  approveWordSuggestion,
  deleteWordSuggestion,
  suggestNewWord,
  updateWordSuggestion,
  getWordSuggestions,
  getWordSuggestion,
  getExampleSuggestion,
} from './shared/commands';
import {
  wordSuggestionId,
  wordSuggestionData,
  wordSuggestionApprovedData,
  malformedWordSuggestionData,
  updatedWordSuggestionData,
  wordSuggestionWithNestedExampleSuggestionData,
} from './__mocks__/documentData';
import { WORD_SUGGESTION_KEYS, INVALID_ID } from './shared/constants';
import { expectUniqSetsOfResponses, expectArrayIsInOrder } from './shared/utils';
import SortingDirections from '../backend/shared/constants/sortingDirections';

describe('MongoDB Word Suggestions', () => {
  describe('/POST mongodb wordSuggestions', () => {
    it('should save submitted word suggestion', async () => {
      const res = await suggestNewWord(wordSuggestionData);
      expect(res.status).toEqual(200);
      expect(res.body.id).not.toEqual(undefined);
    });

    it('should save submitted word suggestion with a nested example suggestion', async () => {
      const res = await suggestNewWord(wordSuggestionWithNestedExampleSuggestionData);
      expect(res.status).toEqual(200);
      expect(res.body.id).not.toEqual(undefined);
      expect(res.body.examples).toHaveLength(1);
    });

    it('should return a word error because of malformed data', async () => {
      const res = await suggestNewWord(malformedWordSuggestionData);
      expect(res.status).toEqual(400);
      expect(res.body.error).not.toEqual(undefined);
    });

    it('should return a word error because invalid id', async () => {
      const malformedData = { ...wordSuggestionData, originalWordId: 'ok123' };
      const res = await suggestNewWord(malformedData);
      expect(res.status).toEqual(400);
      expect(res.body.error).not.toEqual(undefined);
    });

    it('should throw an error because of invalid word class', async () => {
      const res = await suggestNewWord({
        ...wordSuggestionData,
        wordClass: 'invalid',
      });
      expect(res.status).toEqual(400);
      expect(res.body.error).not.toEqual(undefined);
    });
  });

  describe('/PUT mongodb wordSuggestions', () => {
    it('should update specific wordSuggestion with provided data', async () => {
      const res = await suggestNewWord(wordSuggestionData);
      expect(res.status).toEqual(200);
      const result = await updateWordSuggestion({ id: res.body.id, ...updatedWordSuggestionData });
      expect(result.status).toEqual(200);
      forIn(updatedWordSuggestionData, (value, key) => {
        expect(isEqual(result.body[key], value)).toEqual(true);
      });
      expect(result.body.authorId).toEqual(res.body.authorId);
    });

    it('should update nested exampleSuggestion inside wordSuggestion', async () => {
      const updatedIgbo = 'updated example igbo text';
      const updatedEnglish = 'updated example english text';
      const res = await suggestNewWord(wordSuggestionWithNestedExampleSuggestionData);
      expect(res.status).toEqual(200);
      const updatedExampleSuggestion = { ...res.body.examples[0], igbo: updatedIgbo, english: updatedEnglish };
      const updatedWordSuggestion = {
        ...wordSuggestionWithNestedExampleSuggestionData,
        examples: [updatedExampleSuggestion],
      };
      const result = await updateWordSuggestion({ id: res.body.id, ...updatedWordSuggestion });
      expect(result.status).toEqual(200);
      expect(result.body.examples[0].igbo).toEqual(updatedIgbo);
      expect(result.body.examples[0].english).toEqual(updatedEnglish);
    });

    it('should update nested exampleSuggestion inside wordSuggestion despite invalid associatedWords', async () => {
      const updatedIgbo = 'updated example igbo text';
      const updatedEnglish = 'updated example english text';
      const res = await suggestNewWord(wordSuggestionWithNestedExampleSuggestionData);
      expect(res.status).toEqual(200);
      const updatedExampleSuggestion = {
        ...res.body.examples[0],
        igbo: updatedIgbo,
        english: updatedEnglish,
        associateWords: [INVALID_ID],
      };
      const updatedWordSuggestion = {
        ...wordSuggestionWithNestedExampleSuggestionData,
        examples: [updatedExampleSuggestion],
      };
      const result = await updateWordSuggestion({ id: res.body.id, ...updatedWordSuggestion });
      expect(result.status).toEqual(200);
      expect(result.body.examples[0].igbo).toEqual(updatedIgbo);
      expect(result.body.examples[0].english).toEqual(updatedEnglish);
    });

    it('should delete nested exampleSuggestion inside wordSuggestion', async () => {
      const res = await suggestNewWord(wordSuggestionWithNestedExampleSuggestionData);
      expect(res.status).toEqual(200);
      const exampleSuggestionToDeleteId = res.body.examples[0].id;
      const updatedWordSuggestion = {
        ...wordSuggestionWithNestedExampleSuggestionData,
        examples: [],
      };
      const result = await updateWordSuggestion({ id: res.body.id, ...updatedWordSuggestion });
      expect(result.status).toEqual(200);
      expect(result.body.examples).toHaveLength(0);
      getExampleSuggestion(exampleSuggestionToDeleteId)
        .end((_, noExampleSuggestionRes) => {
          expect(noExampleSuggestionRes.status).toEqual(404);
          expect(noExampleSuggestionRes.body.error).not.toEqual(undefined);
        });
    });

    it('should throw an error because the nested example suggestion has an invalid id', async () => {
      const res = await suggestNewWord(wordSuggestionWithNestedExampleSuggestionData);
      expect(res.status).toEqual(200);
      const updatedExampleSuggestion = { ...res.body.examples[0], id: INVALID_ID };
      const updatedWordSuggestion = {
        ...wordSuggestionWithNestedExampleSuggestionData,
        examples: [updatedExampleSuggestion],
      };
      const result = await updateWordSuggestion(updatedWordSuggestion);
      expect(result.status).toEqual(400);
      expect(result.body.error).not.toEqual(undefined);
    });

    it.skip('should throw an error when new yet identical exampleSuggestion data is provided', async () => {
      const res = await suggestNewWord(wordSuggestionWithNestedExampleSuggestionData);
      expect(res.status).toEqual(200);
      const duplicateExampleSuggestionsInWordSuggestion = res.body;
      const { igbo, english } = res.body.examples[0];
      duplicateExampleSuggestionsInWordSuggestion.examples.push({ igbo, english });
      const result = await updateWordSuggestion(duplicateExampleSuggestionsInWordSuggestion);
      console.log(result);
      expect(result.status).toEqual(400);
      expect(result.body.error).not.toEqual(undefined);
    });

    it('should return an example error because of malformed data', async () => {
      const res = await suggestNewWord(wordSuggestionData);
      expect(res.status).toEqual(200);
      const result = await updateWordSuggestion(malformedWordSuggestionData);
      expect(result.status).toEqual(400);
    });

    it('should return an error because document doesn\'t exist', async () => {
      const res = await getWordSuggestion(INVALID_ID);
      expect(res.status).toEqual(400);
      expect(res.body.error).not.toEqual(undefined);
    });

    it('should throw an error for providing an invalid id', async () => {
      const res = await updateWordSuggestion({ id: INVALID_ID });
      expect(res.status).toEqual(400);
      expect(res.body.error).not.toEqual(undefined);
    });

    it('should update the updatedAt field', async () => {
      const wordSuggestionsRes = await getWordSuggestions();
      expect(wordSuggestionsRes.status).toEqual(200);
      const wordSuggestion = wordSuggestionsRes.body[0];
      const res = await updateWordSuggestion({ ...wordSuggestion, word: 'updated' });
      expect(res.status).toEqual(200);
      expect(Date.parse(wordSuggestion.updatedAt)).toBeLessThan(Date.parse(res.body.updatedAt));
    });
  });

  describe('/GET mongodb wordSuggestions', () => {
    it('should return a word suggestion by searching', async () => {
      const keyword = wordSuggestionData.word;
      await suggestNewWord(wordSuggestionData);
      const res = await getWordSuggestions({ keyword });
      expect(res.status).toEqual(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].word).toEqual(keyword);
    });

    it('should return a word suggestion by searching', async () => {
      const filter = wordSuggestionData.word;
      await suggestNewWord(wordSuggestionData);
      const res = await getWordSuggestions({ filter: { word: filter } });
      expect(res.status).toEqual(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].word).toEqual(filter);
    });

    it('should return all word suggestions', async () => {
      await Promise.all([suggestNewWord(wordSuggestionData), suggestNewWord(wordSuggestionData)]);
      const res = await getWordSuggestions({ dialects: true, examples: true });
      expect(res.status).toEqual(200);
      expect(res.body.length).toBe(10);
      forEach(res.body, (wordSuggestion) => {
        WORD_SUGGESTION_KEYS.forEach((wordSuggestionKey) => {
          expect(wordSuggestion).toHaveProperty(wordSuggestionKey);
        });
      });
    });

    it('should be sorted by number of approvals', async () => {
      const wordSuggestionsRes = await Promise.all([
        suggestNewWord(wordSuggestionData),
        suggestNewWord(wordSuggestionApprovedData),
      ]);
      await approveWordSuggestion(wordSuggestionsRes[0].body);
      const res = await getWordSuggestions();
      expect(res.status).toEqual(200);
      expectArrayIsInOrder(res.body, 'approvals', SortingDirections.DESCENDING);
    });

    it('should return one word suggestion', async () => {
      const res = await suggestNewWord(wordSuggestionData);
      const result = await getWordSuggestion(res.body.id);
      expect(result.status).toEqual(200);
      WORD_SUGGESTION_KEYS.forEach((wordSuggestionKey) => {
        expect(result.body).toHaveProperty(wordSuggestionKey);
      });
    });

    it('should return at most twenty five word suggestions per request with range query', async () => {
      const res = await Promise.all([
        getWordSuggestions({ range: true }),
        getWordSuggestions({ range: '[10,34]' }),
        getWordSuggestions({ range: '[35,59]' }),
      ]);
      expectUniqSetsOfResponses(res, 25);
    });

    it('should return at most four word suggestions per request with range query', async () => {
      const res = await getWordSuggestions({ range: '[5,8]' });
      expect(res.status).toEqual(200);
      expect(res.body.length).toBeLessThanOrEqual(4);
    });

    it('should return at most thirty word suggestions because of a large range', async () => {
      const res = await getWordSuggestions({ range: '[10,39]' });
      expect(res.status).toEqual(200);
      expect(res.body.length).toBeLessThanOrEqual(30);
    });

    it('should return at most ten word suggestions because of a tiny range', async () => {
      const res = await getWordSuggestions({ range: '[10,9]' });
      expect(res.status).toEqual(200);
      expect(res.body.length).toBeLessThanOrEqual(10);
    });

    it('should throw an error due to an invalid range', async () => {
      const res = await getWordSuggestions({ range: 'incorrect' });
      expect(res.status).toEqual(400);
      expect(res.body.error).not.toEqual(undefined);
    });

    it('should return at most ten word suggestions per request with range query', async () => {
      const res = await Promise.all([
        getWordSuggestions({ range: '[0,9]' }),
        getWordSuggestions({ range: '[10,19]' }),
        getWordSuggestions({ range: '[20,29]' }),
        getWordSuggestions({ range: [30, 39] }),
      ]);
      expectUniqSetsOfResponses(res);
    });

    it('should return different sets of word suggestions for pagination', async () => {
      const res = await Promise.all([
        getWordSuggestions({ page: 0 }),
        getWordSuggestions({ page: 1 }),
        getWordSuggestions({ page: 2 }),
      ]);
      expectUniqSetsOfResponses(res);
    });

    it('should return prioritize range over page', async () => {
      const res = await Promise.all([
        getWordSuggestions({ page: '1' }),
        getWordSuggestions({ page: '1', range: '[100,109]' }),
      ]);
      expect(isEqual(res[0].body, res[1].body)).toEqual(false);
    });

    it('should return a descending sorted list of word suggestions with sort query', async () => {
      const key = 'word';
      const direction = SortingDirections.DESCENDING;
      const res = await getWordSuggestions({ sort: `["${key}", "${direction}"]` });
      expect(res.status).toEqual(200);
      expectArrayIsInOrder(res.body, key, direction);
    });

    it('should return an ascending sorted list of word suggestions with sort query', async () => {
      const key = 'definitions';
      const direction = SortingDirections.ASCENDING;
      const res = await getWordSuggestions({ sort: `["${key}", "${direction}"]` });
      expect(res.status).toEqual(200);
      expectArrayIsInOrder(res.body, key, direction);
    });

    it('should throw an error due to malformed sort query', async () => {
      const key = 'wordClass';
      const res = await getWordSuggestions({ sort: `["${key}]` });
      expect(res.status).toEqual(400);
      expect(res.body.error).not.toEqual(undefined);
    });

    it('should throw an error for providing an invalid id', async () => {
      const res = await getWordSuggestion(INVALID_ID);
      expect(res.status).toEqual(400);
      expect(res.body.error).not.toEqual(undefined);
    });
  });

  describe('/DELETE mongodb wordSuggestions', () => {
    it('should delete a single word suggestion', async () => {
      const res = await suggestNewWord(wordSuggestionData);
      expect(res.status).toEqual(200);
      const result = await deleteWordSuggestion(res.body.id);
      expect(result.status).toEqual(200);
      expect(result.body.id).not.toEqual(undefined);
      const resError = await getWordSuggestion(result.body.id);
      expect(resError.status).toEqual(404);
      expect(resError.body.error).not.toEqual(undefined);
    });

    it('should return an error for attempting to deleting a non-existing word suggestion', async () => {
      const deleteRes = await deleteWordSuggestion(INVALID_ID);
      expect(deleteRes.status).toEqual(400);
    });

    it('should return error for non existent word suggestion', async () => {
      const res = await getWordSuggestion(wordSuggestionId);
      expect(res.status).toEqual(404);
      expect(res.body.error).not.toEqual(undefined);
    });

    it('should throw an error for providing an invalid id', async () => {
      const res = await deleteWordSuggestion(INVALID_ID);
      expect(res.status).toEqual(400);
      expect(res.body.error).not.toEqual(undefined);
    });
  });
});
