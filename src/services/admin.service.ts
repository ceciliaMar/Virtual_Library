import { sendEmail, SendEmailOutput } from "./email.service";
import { getRepository, Repository } from "typeorm";
import { Book } from "../entity/book.entity";

//enviar el reporte administrativo
export async function sendReport(): Promise<SendEmailOutput> {
  console.log("!---- Send admin report");
  const bookRepository = getRepository(Book);
  const currentDate = new Date();
  var subject = "Virtual Library - Administration - Weekly Report";
  var message = "RENTS REPORT ";
  // recuperar todos los libros prestados
  const rentedBooks = await bookRepository.find({
    where: { isOnLoan: true },
    relations: ["rentalData", "rentalData.user"],
  });
  //para cada libro imprimir su informacion
  rentedBooks.forEach((book: Book) => {
    let rentalDays = Math.floor(
      (currentDate.getTime() - new Date(book.rentalData!.out).getTime()) /
        86400000
    );
    // Muestra Titulo del libro, fecha de alquiler, cantidad de dias transcurridos desde el inicio del alquiler ...

    message +=
      " Title: " +
      book.title +
      ". User: " +
      book.rentalData!.user.fullName +
      ". Email: " +
      book.rentalData!.user.email;
    message +=
      ". Rental date: " + book.rentalData!.out + ". Total days: " + rentalDays;
    // .. y si el libro sobrepasa el limite de 7 dias, informo la multa
    if (rentalDays > 7) message += ". Penalty: " + (rentalDays - 7) * 100;
    console.log(
      "BOOK? ",
      book.title,
      " days of rent ? ",
      rentalDays,
      " from : ",
      book.rentalData!.out
    );
  });
  // enviar el reporte por email a administracion
  const sentEmailResponse = await sendEmail({
    subject: subject,
    message: message,
    address: "nicola.spinka11@ethereal.email", // La direccion del que recibe el informe
  });
  return sentEmailResponse;
}

// enviar alerta de alquiler a los usuarios
export async function sendAlerts(): Promise<Object> {
  const bookRepository = getRepository(Book);
  const currentDate = new Date();
  // recuperar todos los libros en alquiler
  const rentedBooks = await bookRepository.find({
    where: { isOnLoan: true },
    relations: ["rentalData", "rentalData.user"],
  });

  for (let i = 0; i < rentedBooks.length; i++) {
    let book: Book = rentedBooks[i];
    let daysSinceOut = Math.floor(
      (currentDate.getTime() - new Date(book.rentalData!.out).getTime()) /
        86400000
    );
    if (daysSinceOut > 7) {
      let subject = "Virtual Library - Rental expired - Book : " + book.title;
      //la alerta lleva el nombre del libro , la fecha de alquiler, la cantidad de dias transcurridos y la multa a pagar
      let message = "REPORTE DE ALQUILER VENCIDO: ";
      message += "Titulo: " + book.title + ".";
      message += " Fecha de alquiler: " + book.rentalData!.out + ".";
      message += " Cantidad de dÃ­as: " + daysSinceOut + ".";
      message +=
        " Multa: " +
        (daysSinceOut - 7) * 100 +
        " pesos (100 pesos por dí­a extra)";
      console.log(
        "Plazo de préstamo excedido de: ",
        book.title,
        " Cantidad de días: ",
        daysSinceOut,
        " Fecha de alquiler : ",
        book.rentalData!.out
      );
      // enviar la alerta por email al usuario
      const emailResponse = await sendEmail({
        subject: subject,
        message: message,
        address: book.rentalData!.user.email,
      });
    }
  }
  return {
    status: true,
    message: "Alert sent !",
  };
}
