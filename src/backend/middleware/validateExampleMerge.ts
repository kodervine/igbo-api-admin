import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

const { Types } = mongoose;
const exampleMergeDataSchema = Joi.object().keys({
  id: Joi.string().external(async (value) => {
    if (value && !Types.ObjectId.isValid(value)) {
      throw new Error('Invalid original example id provided');
    }
    return true;
  }),
});

export default async (req: Request, res: Response, next: NextFunction): Promise<Response<any> | void> => {
  const { body: finalData, user } = req;

  if (!user || (user && !user.uid)) {
    res.status(400);
    return res.send(new Error('User uid is required'));
  }

  try {
    await exampleMergeDataSchema.validateAsync(finalData, { abortEarly: false });
    return next();
  } catch (err) {
    res.status(400);
    return res.send(err);
  }
};
