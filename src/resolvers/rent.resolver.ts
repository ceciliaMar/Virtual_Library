import {
  Resolver,
  Query,
  Mutation,
  Arg,
  InputType,
  Field,
  Args,
  UseMiddleware,
  ObjectType,
} from "type-graphql";
import { getRepository, IsNull, Repository } from "typeorm";
import { IContext, isAuth } from "../middlewares/auth.middleware";
import { Rent } from "../entity/rent.entity";
import { Book } from "../entity/book.entity";
import { User } from "../entity/user.entity";

@InputType()
class NewRentInput {
  @Field()
  book!: number;
  @Field()
  user!: number;
}

@InputType()
class GetRentsByUserInput {
  @Field()
  userId!: number;
}

@InputType()
class ReturnBookInput {
  @Field()
  bookId!: number;
}
@ObjectType()
class ReturnBookOutput {
  @Field()
  book!: Book;
  @Field()
  rent!: Rent;
  @Field()
  penalty?: Number;
  @Field()
  message?: String;
}

@Resolver()
export class RentResolver {
  rentRepository: Repository<Rent>;
  bookRepository: Repository<Book>;
  userRepository: Repository<User>;

  constructor() {
    this.rentRepository = getRepository(Rent);
    this.bookRepository = getRepository(Book);
    this.userRepository = getRepository(User);
  }

  @Mutation(() => Rent)
  @UseMiddleware(isAuth)
  async newRent(
    @Arg("input", () => NewRentInput) input: NewRentInput
  ): Promise<Rent | undefined> {
    try {
      const book: Book | undefined = await this.bookRepository.findOne(
        input.book
      );

      if (!book) {
        const error = new Error();
        error.message = "The book does not exist";
        console.log(error.message);
        throw error;
      }

      if (book.isOnLoan) {
        const error = new Error();
        error.message = "The book " + book.title + "is not available";
        console.log(error.message);
        throw error;
      } else {
        console.log("The book is available");

        const libraryUser = await this.userRepository.findOne(input.user); //{where: { id : input.user}}
        if (!libraryUser) {
          const error = new Error();
          error.message = "The user does not exist";
          console.log(error.message);
          throw error;
        }
        // ... el usuario tiene otros alquileres ? si tiene 3 entonces no puede seguir alquilando
        const activeRents = await this.rentRepository.find({
          where: { user: libraryUser.id, in: IsNull() },
        });
        if (activeRents.length == 3) {
          const error = new Error(
            "It is not possible to rent more than 3 books"
          );
          console.log(error);
          throw error;
        }
        // guardado del nuevo registro de alquiler
        const currentDay = new Date();
        const newRentResult = await this.rentRepository.insert({
          book: book,
          user: libraryUser,
          out: currentDay.toISOString(),
        });

        book.isOnLoan = true;
        book.rentalData = newRentResult.identifiers[0].id;
        await this.bookRepository.save(book);

        const result = await this.rentRepository.findOne(
          newRentResult.identifiers[0].id,
          { relations: ["book", "user"] }
        );
        console.log("Rent register Complete ! ", result);
        return result;
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Query(() => [Rent])
  async getAllRents() {
    try {
      const rents = await this.rentRepository.find({
        relations: ["book", "user"],
      });
      console.log(rents);
      return rents;
    } catch {
      console.error;
    }
  }

  @Query(() => [Rent])
  async getRentsByUser(
    @Arg("input", () => GetRentsByUserInput)
    input: GetRentsByUserInput
  ) {
    console.log("Buscar alquileres para el usuario ID: ", input.userId);
    try {
      const result = await this.rentRepository.find({
        where: { user: input.userId },
        relations: ["book", "user"],
      });
      console.log("Resultado : ", result);
      return result;
    } catch {
      const error = new Error();
      error.message = "Se produjo un error al recuperar los datos!";
      console.log(error.message);
      throw error;
    }
  }

  @Mutation(() => ReturnBookOutput)
  @UseMiddleware(isAuth)
  async returnBook(
    @Arg("input", () => ReturnBookInput) input: ReturnBookInput
  ) {
    try {
      const book = await this.bookRepository.findOne(input.bookId, {
        relations: ["author", "rentalData"],
      });

      if (!book) {
        const error = new Error("The book does not exist");
        console.log(error);
        throw error;
      }

      if (!book.isOnLoan) {
        const error = new Error("The book is not rented");
        console.log(error);
        throw error;
      }

      if (!book.rentalData) {
        const error = new Error("No rental data found");
        console.log(error);
        throw error;
      }
      // actualizo la informacion del registro de alquiler
      const currentDay = new Date();
      book.rentalData.in = currentDay.toISOString();
      const rentUpdate = await this.rentRepository.save(book.rentalData);
      // actualizo el libro para que no figure como alquilado
      book.isOnLoan = false;
      book.rentalData = null;
      await this.bookRepository.save(book);
      // calcular la multa
      const dailyPenalty = 100;
      var daysOfRent = Math.floor(
        (currentDay.getTime() - new Date(rentUpdate.out).getTime()) / 86400000
      );

      var penalty = daysOfRent > 7 ? (daysOfRent - 7) * dailyPenalty : 0;
      console.log("Days of delay : ", daysOfRent, " penalty : " + penalty);

      const result = new ReturnBookOutput();
      result.book = book;
      result.rent = rentUpdate;
      result.penalty = penalty;
      result.message =
        "The book " +
        book.title +
        " was returned succesfully after: " +
        daysOfRent +
        " days" +
        " | Delay: " +
        (daysOfRent - 7) +
        " / Penalty : " +
        result.penalty +
        " pesos ( " +
        dailyPenalty +
        " pesos for each extra day )";
      return result;
    } catch (error) {
      throw error;
    }
  }
}
