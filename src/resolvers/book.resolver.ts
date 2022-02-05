import {
  Mutation,
  Resolver,
  Arg,
  InputType,
  Field,
  Query,
  UseMiddleware,
  Ctx,
  ObjectType,
} from "type-graphql";
import { getRepository, Repository } from "typeorm";
import { Author } from "../entity/author.entity";
import { Book } from "../entity/book.entity";
import { Length } from "class-validator";
import { IContext, isAuth } from "../middlewares/auth.middleware";

@InputType()
class BookInput {
  @Field()
  @Length(3, 64)
  title!: string;
  @Field()
  author!: number;
}

@InputType()
class BookUpdateInput {
  @Field(() => String, { nullable: true })
  @Length(3, 64)
  title?: string;
  @Field(() => Number, { nullable: true })
  author?: number;
}

@InputType()
class BookUpdateParsedInput {
  @Field(() => String, { nullable: true })
  @Length(3, 64)
  title?: string;
  @Field(() => Author, { nullable: true })
  author?: Author;
}

@InputType()
class BookIdInput {
  @Field(() => Number)
  id!: number;
}

@ObjectType()
class GetBookByIdOutput {
  @Field()
  book!: Book;
  @Field({ nullable: true })
  inBy?: string;
}
@Resolver()
export class BookResolver {
  bookRepository: Repository<Book>;
  authorRepository: Repository<Author>;

  constructor() {
    this.bookRepository = getRepository(Book);
    this.authorRepository = getRepository(Author);
  }
  // Recupera todos los libros, indicando si está o no disponible
  @Query(() => [Book])
  @UseMiddleware(isAuth)
  async getAllBooks(): Promise<Book[]> {
    try {
      return await this.bookRepository.find({
        relations: ["author", "author.books", "rentalData", "rentalData.user"],
      });
    } catch (error) {
      throw error;
    }
  }

  // Recupera un libro buscando por su ID , en el caso de estar alquilado retorna la fecha estimada de devolucion
  @Query(() => GetBookByIdOutput)
  @UseMiddleware(isAuth)
  async getBookById(
    @Arg("input", () => BookIdInput) input: BookIdInput
  ): Promise<GetBookByIdOutput | undefined> {
    try {
      const book = await this.bookRepository.findOne(input.id, {
        relations: ["author", "author.books", "rentalData", "rentalData.user"],
      });
      if (!book) {
        const error = new Error();
        error.message = "Book not found";
        throw error;
      }
      const response = new GetBookByIdOutput();
      response.book = book;
      if (book.isOnLoan) {
        let inBy = new Date(book.rentalData!.out);
        inBy.setDate(inBy.getDate() + 7);
        response.inBy = inBy.toLocaleDateString();
      }
      return response;
    } catch (error) {
      throw error;
    }
  }

  @Mutation(() => Book)
  async createBook(
    @Arg("input", () => BookInput) input: BookInput,
    @Ctx() context: IContext
  ) {
    try {
      const author: Author | undefined = await this.authorRepository.findOne(
        input.author
      );
      if (!author) {
        const error = new Error();
        error.message =
          "The author for this book does not exist, please double check";
        throw error;
      }
      const book = await this.bookRepository.insert({
        title: input.title,
        author: author,
        isOnLoan: false,
      });

      const newBook = await this.bookRepository.findOne(
        book.identifiers[0].id,
        { relations: ["author", "author.books"] }
      );
      console.log("New book  : ", newBook);
      return newBook;
    } catch (error) {
      throw error;
    }
  }

  @Mutation(() => Boolean)
  async updateBookById(
    @Arg("bookId", () => BookIdInput) bookId: BookIdInput,
    @Arg("input", () => BookUpdateInput) input: BookUpdateInput
  ): Promise<Boolean> {
    try {
      await this.bookRepository.update(bookId.id, await this.parseInput(input));
      return true;
    } catch (error) {
      throw error;
    }
  }

  @Mutation(() => Boolean)
  async deleteBook(
    @Arg("bookId", () => BookIdInput) bookId: BookIdInput
  ): Promise<Boolean> {
    try {
      const result = await this.bookRepository.delete(bookId.id);
      if (result.affected === 0) throw new Error("Book does not exist");
      return true;
    } catch (error) {
      throw error;
    }
  }

  private async parseInput(input: BookUpdateInput) {
    try {
      const _input: BookUpdateParsedInput = {};
      if (input.title) {
        _input["title"] = input.title;
      }
      if (input.author) {
        const author = await this.authorRepository.findOne(input.author);
        if (!author) {
          throw new Error("This author does not exist");
        }
        _input["author"] = await this.authorRepository.findOne(input.author);
      }
      return _input;
    } catch (error) {
      throw error;
    }
  }
}
