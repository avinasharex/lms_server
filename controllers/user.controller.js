import User from "../models/user.model.js";
import AppError from "../utils/error.util.js";
import cloudinary from "cloudinary"
import fs from 'fs/promises'
import sendEmail from "../utils/sendEmail.js";
import crypto from "crypto"

const cookieOption = {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: false
}

const register = async (req, res, next) => {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
        return next(new AppError("All field are required", 400))
    }

    const userExist = await User.findOne({ email })

    if (userExist) {
        return next(new AppError("Email already exists", 400))
    }

    const user = await User.create({
        fullName,
        email,
        password,
        avatar: {
            public_id: email,
            secure_url: 'https://github.com/avinasharex/auth/blob/main/model/userSchema.js'
        }
    })

    if (!user) {
        return next(new AppError("User registration failed, please try again", 400))
    }

    // TODO - file upload
    if (req.file) {
        try {
            const result = await cloudinary.v2.uploader.upload(req.file.path, {
                folder: "lms",
                width: 250,
                height: 250,
                gravity: 'faces',
                crop: 'fill'
            })

            if (result) {
                user.avatar.public_id = result.public_id,
                    user.avatar.secure_url = result.secure_url
            }

            // Remove file from server
            fs.rm('uploads/' + req.file.filename)
        } catch (e) {
            return next(new AppError(e.message, 500))

        }
    }

    await user.save()

    user.password = undefined

    res.status(201).json({
        success: true,
        message: "User registerd successfully",
        user
    })
}
const login = async (req, res, next) => {

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return next(new AppError("All field are required", 400))
        }

        const user = await User.findOne({ email }).select("+password")

        if (!user || !(await user.comparePassword(password))) {
            return next(new AppError("Email or password does not match", 400))
        }

        const token = await user.generateJWTToken()
        user.password = undefined

        res.cookie("token", token, cookieOption)
        res.status(201).json({
            success: true,
            message: "User login successfully",
            user
        })
    } catch (e) {
        return next(new AppError(e.message, 500))
    }

}
const logout = (req, res) => {
    res.cookie("token", null, {
        maxAge: 0,
        httpOnly: true,
        secure: true
    })

    res.status(200).json({
        success: true,
        message: "User logged out successfully",
    })
}
const getProfile = async (req, res, next) => {

    try {
        const userId = req.user.id;

        const user = await User.findById(userId)

        res.status(200).json({
            success: true,
            message: "User details",
            user
        })
    } catch (e) {
        return next(new AppError(e.message, 500))
    }
}

const forgotPassword = async (req, res, next) => {
    const { email } = req.body;

    if (!email) {
        return next(new AppError("Email is required", 400))
    }

    const user = await User.findOne({ email })

    if (!user) {
        return next(new AppError("Email is not registerd", 400))
    }

    const resetToken = await user.generatePasswordToken()

    await user.save()

    const resetPasswordURL = `${process.env.FRONTED_URL}/reset-password/${resetToken}`
    const subject = 'Reset password'
    const message = `You can reset your password by clicking <a href="${resetPasswordURL}" target="_blank"> Reset your password </a>\n If the above link does not work for some reason then copy paste this link in new tab ${resetPasswordURL}.\n If you have not requested this, kindly ignore.`

    console.log(resetPasswordURL)

    try {
        await sendEmail(email, subject, message)

        res.status(200).json({
            success: true,
            message: `Reset password token send to ${email} successfully`
        })
    } catch (e) {
        user.forgetPasswordExpiry = undefined
        user.forgetPasswordToken = undefined

        await user.save();
        return next(new AppError(e.message, 400))
    }


}

const resetPassword = async (req, res, next) => {
    const { resetToken } = req.params;

    const { password } = req.body
    const forgetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex")

    const user = await User.findOne({
        forgetPasswordToken,
        forgetPasswordExpiry: { $gt: Date.now() }
    })

    if (!user) {
        return next(new AppError("Token is invalid or expiry, please try again", 400))
    }

    user.password = password
    user.forgetPasswordToken = undefined
    user.forgetPasswordExpiry = undefined

    await user.save()

    res.status(200).json({
        success: true,
        message: "Password changed successfully!"
    })
}

const changePassword = async (req, res, next) => {
    const { oldPassword, newPassword } = req.body
    const { id } = req.user

    if (!oldPassword || !newPassword) {
        return next(new AppError("All field are manadatory", 400))
    }

    const user = await User.findById(id).select("+password")

    if (!user) {
        return next(new AppError("User does not exist", 400))
    }

    const isValidPassword = user.comparePassword(oldPassword)

    if (!isValidPassword) {
        return next(new AppError("Wrong old password", 400))
    }

    user.password = newPassword

    await user.save()

    user.password = undefined

    res.status(200).json({
        success: true,
        message: "Password changed successfully!"
    })
}

const updateUser = async (req, res, next) => {
    const { fullName } = req.body
    const { id } = req.params

    const user = await User.findById(id)

    if (!user) {
        return next(new AppError("User does not exist", 400))
    }

    if (fullName) {
        user.fullName = fullName
    }
    
    if (req.file) {
        await cloudinary.v2.uploader.destroy(user.avatar.public_id)
        try {
            const result = await cloudinary.v2.uploader.upload(req.file.path, {
                folder: "lms",
                width: 250,
                height: 250,
                gravity: 'faces',
                crop: 'fill'
            })

            if (result) {
                user.avatar.public_id = result.public_id,
                    user.avatar.secure_url = result.secure_url
                }
                
                // Remove file from server
            fs.rm('uploads/' + req.file.filename)
        } catch (e) {
            return next(new AppError(e.message, 500))
            
        }
    }
    
    await user.save()
    
    res.status(200).json({
        success: true,
        message: "User detail updated successfully"
    })
}


export {
    register,
    login,
    logout,
    getProfile,
    forgotPassword,
    resetPassword,
    changePassword,
    updateUser
}