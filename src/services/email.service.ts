import { Field, InputType, ObjectType } from "type-graphql";
import { environment } from "../config/environment";

@InputType()
export class SendEmailInput {
  @Field()
  address!: string;
  @Field()
  subject!: string;
  @Field()
  message!: string;
}

@ObjectType()
export class SendEmailOutput {
  @Field()
  success!: boolean;
  @Field()
  message!: string;
  @Field()
  previewURL!: string;
}

/* Procedimiento para el envio de un email */
export async function sendEmail(
  input: SendEmailInput
): Promise<SendEmailOutput> {
  const nodemailer = require("nodemailer");
  try {
    const testAccount = await nodemailer.createTestAccount(
      (err: any, account: any) => {
        if (err) {
          const error = new Error("Error: " + err.message);
          console.log(error.message);
          throw error;
        }
      }
    );
    const transporter = nodemailer.createTransport({
      host: environment.EMAIL_HOST,
      port: environment.EMAIL_PORT,
      secure: false,
      auth: {
        user: environment.EMAIL_USER,
        pass: environment.EMAIL_PASSWORD,
      },
    });

    // Estructura del email
    let message = {
      from: '"Library Administration" <admin@virtual_library.com>', // sender address
      to: input.address, // list of receivers
      subject: input.subject, // Subject line
      text: input.message, // plain text body
      html: input.message, // html body
    };

    const mailSending = async function () {
      return new Promise((resolve) => {
        transporter.sendMail(message, (err: any, info: any) => {
          if (err) {
            console.log("Error:  " + err.message);
            resolve({ success: false, message: err.message });
          }
          resolve({
            success: true,
            message: "Email sent to " + input.address,
            previewURL: nodemailer.getTestMessageUrl(info),
          });
          console.log("Email sent !");
          console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
          console.log("Message sent: %s", input.message);
        });
      });
    };

    const result = Object(await mailSending());
    const dataOutput = new SendEmailOutput();
    if (result["success"]) {
      dataOutput.message = result["message"];
      dataOutput.previewURL = result["previewURL"];
    } else {
      dataOutput.success = false;
      dataOutput.message = result["message"];
    }

    return dataOutput;
  } catch (error) {
    throw error;
  }
}
