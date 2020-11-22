import { getCustomRepository, getRepository } from 'typeorm';
import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';


interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({ title, value, type, category }: Request): Promise<Transaction> {
    const categoryRepository = getRepository(Category);
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    let createdCategory = await categoryRepository.findOne({
      where: {
        title: category
      }
    });

    if (!createdCategory) {
      createdCategory = categoryRepository.create({ title: category });
      await categoryRepository.save(createdCategory);
    }

    const balance = await transactionsRepository.getBalance();

    if (balance.total < value && type === 'outcome') {
      throw new AppError("You don't have enough money");
    }

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category: createdCategory
    });

    await transactionsRepository.save(transaction);

    return transaction;

  }
}

export default CreateTransactionService;
