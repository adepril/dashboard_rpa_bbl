import { NextResponse } from 'next/server';
import { contactFormSchema } from '@/lib/schemas/contact';
import { createMailTransporter, createMailOptions } from '@/lib/mail/nodemailer';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = contactFormSchema.parse(body);

    const transporter = createMailTransporter();
    const mailOptions = createMailOptions(validatedData);

    await transporter.sendMail(mailOptions);

    return NextResponse.json(
      { message: 'Email sent successfully' },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Validation error', errors: error.errors },
        { status: 400 }
      );
    }

    console.error('Email error:', error);
    return NextResponse.json(
      { message: 'Failed to send email' },
      { status: 500 }
    );
  }
}