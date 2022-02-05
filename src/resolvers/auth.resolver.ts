import { IsEmail, Length } from "class-validator";
import {
  Arg,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "type-graphql";
import { getRepository, Repository } from "typeorm";
import { User } from "../entity/user.entity";
import { hash, compareSync } from "bcryptjs";
import { sign, verify } from "jsonwebtoken";
import { environment } from "../config/environment";
import { sendEmail } from "../services/email.service";

@InputType()
class UserInput {
  @Field()
  @Length(3, 64)
  fullName!: string;
  @Field()
  @IsEmail()
  email!: string;
  @Field()
  @Length(8, 254)
  password!: string;
}

@ObjectType()
class RegisterOutput {
  @Field()
  user!: User;
  @Field()
  tokenValidation!: String;
}

@InputType()
class LoginInput {
  @Field()
  @IsEmail()
  email!: string;
  @Field()
  password!: string;
}

@ObjectType()
class LoginOutput {
  @Field()
  userId!: number;
  @Field()
  jwt!: string;
}

@InputType()
class GetUserDataInput {
  @Field()
  id!: number;
}

@InputType()
class RestorePasswordInput {
  @Field()
  email!: string;
}
@ObjectType()
class RestorePasswordOutput {
  @Field()
  succes!: boolean;
  @Field()
  message!: string;
  @Field()
  token!: string;
  @Field()
  emailPreviewURL?: string;
}

@InputType()
class ValidateMailInput {
  @Field()
  token!: string;
}
@ObjectType()
class ValidateMailOutput {
  @Field()
  status!: boolean;
  @Field()
  message!: string;
}

@InputType()
class ChangePasswordInput {
  @Field()
  newPassword!: string;
  @Field()
  token!: string;
}
@ObjectType()
class ChangePasswordOutput {
  @Field()
  user!: User;
  @Field({ nullable: true })
  message!: String;
  @Field({ nullable: true })
  mailNotificationPreview!: String;
}

@InputType()
class GenerateTokenInput {
  @Field()
  email!: string;
}

@ObjectType()
class GenerateTokenOutput {
  @Field()
  token!: string;
  @Field()
  emailPreview!: string;
}

@Resolver()
export class AuthResolver {
  userRepository: Repository<User>;
  constructor() {
    this.userRepository = getRepository(User);
  }

  // Registrar un nuevo usuario
  @Mutation(() => RegisterOutput)
  async register(
    @Arg("input", () => UserInput) input: UserInput
  ): Promise<RegisterOutput | undefined> {
    try {
      const { fullName, email, password } = input;
      // existe otro usuario con el mismo email ? ...
      const userExists = await this.userRepository.findOne({
        where: { email },
      });
      if (userExists) {
        const error = new Error("The email is already registered");
        console.log(error.message);
        throw error;
      }
      // guardar el nuevo usuario
      const hashedPassword = await hash(password, 10);
      const insertResult = await this.userRepository.insert({
        fullName,
        email,
        password: hashedPassword,
        valid: false,
      });
      // recuperar el nuevo usuario creado
      const newUserCreated = await this.userRepository.findOne(
        insertResult.identifiers[0].id
      );
      if (!newUserCreated) {
        const error = new Error("User not found");
        console.log(error.message);
        throw error;
      }
      // token de validación de dirección de correo
      const tokenValidation = sign(
        { id: newUserCreated.id },
        environment.JWT_SECRET
      );
      // enviar email de validación
      const emailResponse = await sendEmail({
        subject: "Virtual Library - Email validation",
        message: "Validate your Email address, TOKEN : " + tokenValidation,
        address: email,
      });
      console.log("Email sent");
      // retorno del procedimiento
      return {
        user: newUserCreated,
        tokenValidation: tokenValidation,
      };
    } catch (error) {
      throw error;
    }
  }

  // Validar una cuenta de correo pasando como parametro un token
  @Mutation(() => ValidateMailOutput)
  async validateMail(
    @Arg("input", () => ValidateMailInput) input: ValidateMailInput
  ) {
    console.log("!----- VALIDAR CORREO ");
    console.log("Parametros: ", input);
    try {
      // los datos que vienen dentro del token (user.id)
      const payload = verify(input.token, environment.JWT_SECRET) as any;
      console.log("USER ID ? ", payload.id);
      // buscar el usuario que tiene ese id
      const userFound = await this.userRepository.findOne(payload.id);
      // existe el usuario ? ...
      if (!userFound) {
        const error = new Error("User " + payload.id + " not found");
        console.log(error.message);
        throw error;
      }
      // la direccion de correo ya fue validada ? ...
      if (userFound.valid) {
        const response = new ValidateMailOutput();
        response.status = false;
        response.message = "The email was already validated";
        console.log(response.message);
        return response;
      }
      // actualizar el estado de validación del usuario
      const resultUpdate = await this.userRepository.update(
        { id: userFound.id },
        { valid: true }
      );
      if (!resultUpdate) {
        const error = new Error("Fail to update");
        console.log(error.message);
        throw error;
      }
      // respuesta del procedimiento
      const response = new ValidateMailOutput();
      response.status = true;
      response.message = "Email validated";
      console.log(response.message);
      return response;
    } catch (error) {
      throw error;
    }
  }

  /* Generar un token de validación de correo */
  @Query(() => GenerateTokenOutput)
  async generateValidationTokenMail(
    @Arg("input", () => GenerateTokenInput) input: GenerateTokenInput
  ) {
    try {
      console.log("! ----- Generate new mail validation token");
      // existe un usuario con ese email? ...
      const user = await this.userRepository.findOne({
        where: { email: input.email },
      });

      if (!user) {
        const error = new Error("User not found");
        console.log(error.message);
        throw error;
      }
      // el usuario ya validó su correo antes ? ...
      if (user?.valid) {
        const error = new Error("Mail already validated");
        console.log(error.message);
        throw error;
      }
      // generar un token de validación
      const t = sign({ id: user.id }, environment.JWT_SECRET);

      const mailResponse = await sendEmail({
        subject: "Virtual Library - Email validation",
        message: "Use this token: " + t + " validar correo",
        address: user.email,
      });
      // respuesta del procedimiento
      const response = new GenerateTokenOutput();
      response.emailPreview = mailResponse.previewURL;
      response.token = t;
      console.log(response);
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Login
  @Mutation(() => LoginOutput)
  async login(@Arg("input", () => LoginInput) input: LoginInput) {
    try {
      const { email, password } = input;
      const userFound = await this.userRepository.findOne({ where: { email } });
      // existe el usuario ? ...
      if (!userFound) {
        const error = new Error();
        error.message = "Invalid credentials";
        throw error;
      }
      // la contraseña es correcta ? ...
      const isValidPasswd: boolean = compareSync(password, userFound.password);
      if (!isValidPasswd) {
        const error = new Error();
        error.message = "Invalid credentials";
        throw error;
      }
      // validó su direccion de correo ? ...
      if (!userFound.valid) {
        const error = new Error("Email must be validated");
        console.log(error.message);
        throw error;
      }
      // genero el token de usuario autorizado
      const jwt: string = sign({ id: userFound.id }, environment.JWT_SECRET);
      // respuesta del login
      return {
        userId: userFound.id,
        jwt: jwt,
      };
    } catch (error) {
      throw error;
    }
  }

  // Recupera todos los usuarios guardados
  @Query(() => [User])
  async getAllUsers(): Promise<User[]> {
    try {
      return await this.userRepository.find();
    } catch (error) {
      throw error;
    }
  }

  // Recuperar un usuario , buscando por ID
  @Query(() => User)
  async getUserData(
    @Arg("input", () => GetUserDataInput) input: GetUserDataInput
  ): Promise<User | undefined> {
    console.log("! ----- User data : ", input.id);
    try {
      const userSearch = await this.userRepository.findOne(input.id);
      if (!userSearch) {
        const error = new Error("User not found");
        throw error;
      }
      return userSearch;
    } catch (error: any) {
      throw error;
    }
  }

  // Recuperar clave de usuario via mail
  @Query(() => RestorePasswordOutput)
  async restorePassword(
    @Arg("input", () => RestorePasswordInput) input: RestorePasswordInput
  ) {
    console.log("! ----- Recuperar Contraseña ");
    const user = await this.userRepository.findOne({
      where: { email: input.email },
    });
    // existe algun usuario con ese email ? ...
    if (!user) {
      const error = new Error();
      error.message = "Email not found";
      throw error;
    }
    // generar token para reiniciar la clave de usuario
    const resetPasswordToken: string = sign(
      { id: user!.id },
      environment.JWT_SECRET
    );
    console.log("Token de reinicio de clave: ", resetPasswordToken);
    // enviar email con el token
    var emailMessage = "Your token is : " + resetPasswordToken;
    emailMessage += "Click here: reiniciar Clave( token, newPassword )";
    const dataResponse = await sendEmail({
      subject: "Virtual Library - Reset password",
      message: emailMessage,
      address: user.email,
    });
    // respuesta del procedimiento
    if (dataResponse.success) {
      let response = new RestorePasswordOutput();
      response.succes = true;
      response.message =
        "Las instrucciones para recuperar la contraseña fueron enviadas a " +
        input.email;
      response.token = resetPasswordToken;
      response.emailPreviewURL = dataResponse.previewURL || "";
      return response;
    } else {
      const error = new Error();
      error.message = dataResponse.message;
      throw error;
    }
  }

  /* Reinicio de la clave de usuario  */
  @Mutation(() => ChangePasswordOutput)
  async resetPassword(
    @Arg("input", () => ChangePasswordInput) input: ChangePasswordInput
  ): Promise<ChangePasswordOutput | undefined> {
    try {
      console.log("! ----- Reset password ");
      const tokenPayload = verify(input.token, environment.JWT_SECRET) as any;
      console.log("User ID ? ", tokenPayload.id);
      // el token contiene un ID de usuario ? ...
      if (!tokenPayload.id) {
        const error = new Error();
        error.message = "Reset fail";
        throw error;
      }
      // recupero el usuario al que se quiere modificar
      const user = await this.userRepository.findOne(tokenPayload.id);
      // ... el usuario existe ?
      if (!user) {
        const error = new Error();
        error.message = "User not found";
        throw error;
      }
      // hasheo de clave
      user.password = await hash(input.newPassword, 10);
      // update del usuario
      const userUpdate = await this.userRepository.save(user);
      // envio de mail con notificacion de cambio de clave
      const emailResponse = await sendEmail({
        subject: "Virtual Library - New password",
        message: user.fullName + " your new password is:" + input.newPassword,
        address: user.email,
      });
      // retorno del procedimiento
      const resultOutput = new ChangePasswordOutput();
      resultOutput.message = "You have a new password";
      resultOutput.user = user;
      resultOutput.mailNotificationPreview = emailResponse.previewURL!;
      return resultOutput;
    } catch (error) {
      throw error;
    }
  }
}
