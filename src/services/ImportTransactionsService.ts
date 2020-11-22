import { getCustomRepository, getRepository, In } from 'typeorm';
import csvParse from 'csv-parse';
import fs from 'fs';

import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface TransactionsDTO {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const categoriesRepository = getRepository(Category);
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const readStream = fs.createReadStream(filePath);

    const csv = csvParse({ from_line: 2 });

    const parse = readStream.pipe(csv);

    const transactions: TransactionsDTO[] = [];
    const categories: string[] = [];

    parse.on('data', async rows => {
      const [title, type, value, category] = rows.map((row: string) => row.trim());

      if (!title || !type || !value) return;

      categories.push(category);
      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parse.on('end', resolve));

    const existentCategories = await categoriesRepository.find({
      where: {
        title: In(categories)
      },
    });

    const findedCategoriesTitle = existentCategories.map((category: Category) => category.title);

    const categoriesTitles = categories.filter(
      category =>!findedCategoriesTitle.includes(category)
    ).filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      categoriesTitles.map(title =>({title}))
    );

    await categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existentCategories];

      const createTransactions = transactionsRepository.create(
        transactions.map(transaction =>({
          title: transaction.title,
          type: transaction.type,
          value: transaction.value,
          category: finalCategories.find(category => category.title === transaction.title)
        }))
      );

      await transactionsRepository.save(createTransactions);

      await fs.promises.unlink(filePath);

      return createTransactions;
  }
}

export default ImportTransactionsService;
