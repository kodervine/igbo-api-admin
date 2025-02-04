import * as functions from 'firebase-functions';
import MediaTypes from '../shared/constants/MediaTypes';
import { corpusSuggestionSchema } from '../models/CorpusSuggestion';
import { getUploadSignature } from './utils/MediaAPIs/CorpusMediaAPI';
import { connectDatabase } from '../utils/database';

export const onMediaSignedRequest = functions.https.onCall(async (
  { id, fileType }:
  { id: string, fileType: MediaTypes },
): Promise<Error | {
  response: { signedRequest: string, mediaUrl: string },
}> => {
  const mongooseConnection = await connectDatabase();
  const CorpusSuggestion = mongooseConnection.model('CorpusSuggestion', corpusSuggestionSchema);
  const corpusSuggestion = await CorpusSuggestion.findById(id);
  if (!corpusSuggestion) {
    throw new functions.https.HttpsError(
      'not-found',
      '',
      'The corpus suggestion doesn\'t exist',
    );
  }
  const response = await getUploadSignature({ id, fileType });
  if (!response.signedRequest) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      '',
      'The request to get the signed url was not successful',
    );
  }
  corpusSuggestion.media = response.mediaUrl;
  corpusSuggestion.markModified('media');
  await corpusSuggestion.save();
  return { response };
});
