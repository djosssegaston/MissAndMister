<?php

namespace Tests\Feature;

use App\Mail\TicketDeliveredMail;
use App\Models\Event;
use App\Models\Ticket;
use App\Models\TicketOrder;
use App\Models\TicketType;
use App\Models\User;
use App\Services\BilletterieService;
use App\Services\TicketPdfService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class BilletterieOrderEmailTest extends TestCase
{
    use RefreshDatabase;

    private function createPublishedEventWithTicketType(): array
    {
        $event = Event::factory()->published()->create();
        $ticketType = TicketType::factory()->create([
            'event_id' => $event->id,
            'price' => 10000,
            'quantity_total' => 100,
            'quantity_sold' => 0,
        ]);

        return [$event, $ticketType];
    }

    public function test_skip_payment_sends_ticket_email(): void
    {
        config()->set('billetterie.skip_payment', true);
        Mail::fake();

        $pdfMock = $this->mock(TicketPdfService::class);
        $pdfMock->shouldReceive('generateOrderPdf')->andReturn('fake-pdf-bytes');

        [$event, $ticketType] = $this->createPublishedEventWithTicketType();
        $user = User::factory()->create();

        $service = app(BilletterieService::class);

        $result = $service->createOrder(
            $user->id,
            $ticketType->id,
            2,
            '127.0.0.1',
            'TestAgent',
            'Jean Dupont',
            $user->email,
            '+22968000000',
            'email',
        );

        $this->assertTrue($result['skipped_payment']);
        $this->assertDatabaseHas('ticket_orders', [
            'status' => 'paid',
            'payment_reference' => $result['order']->payment_reference,
        ]);

        Mail::assertSent(TicketDeliveredMail::class, function (TicketDeliveredMail $mail) use ($user) {
            return $mail->hasTo($user->email);
        });
    }

    public function test_skip_payment_whatsapp_sends_email_anyway(): void
    {
        config()->set('billetterie.skip_payment', true);
        Mail::fake();

        $pdfMock = $this->mock(TicketPdfService::class);
        $pdfMock->shouldReceive('generateOrderPdf')->andReturn('fake-pdf-bytes');

        [$event, $ticketType] = $this->createPublishedEventWithTicketType();

        $service = app(BilletterieService::class);

        $result = $service->createOrder(
            null,
            $ticketType->id,
            1,
            '127.0.0.1',
            'TestAgent',
            'Jean Dupont',
            'jean@example.com',
            '+22968000000',
            'whatsapp',
        );

        $this->assertTrue($result['skipped_payment']);

        Mail::assertSent(TicketDeliveredMail::class);
    }

    public function test_confirm_order_sends_ticket_email(): void
    {
        Mail::fake();

        $pdfMock = $this->mock(TicketPdfService::class);
        $pdfMock->shouldReceive('generateOrderPdf')->andReturn('fake-pdf-bytes');

        [$event, $ticketType] = $this->createPublishedEventWithTicketType();
        $user = User::factory()->create();

        $order = TicketOrder::factory()->pending()->create([
            'user_id' => $user->id,
            'event_id' => $event->id,
            'holder_email' => $user->email,
            'holder_name' => $user->name,
            'total_amount' => 20000,
            'quantity' => 2,
        ]);

        Ticket::factory()->count(2)->create([
            'ticket_order_id' => $order->id,
            'ticket_type_id' => $ticketType->id,
            'user_id' => $user->id,
            'holder_email' => $user->email,
            'status' => 'pending',
        ]);

        $service = app(BilletterieService::class);
        $confirmed = $service->confirmOrder($order->payment_reference);

        $this->assertNotNull($confirmed);
        $this->assertSame('paid', $confirmed->status);

        $this->assertDatabaseHas('tickets', [
            'ticket_order_id' => $order->id,
            'status' => 'valid',
        ]);

        Mail::assertSent(TicketDeliveredMail::class, function (TicketDeliveredMail $mail) use ($user) {
            return $mail->hasTo($user->email);
        });
    }

    public function test_confirm_order_already_paid_does_not_resend_email(): void
    {
        Mail::fake();

        $pdfMock = $this->mock(TicketPdfService::class);
        $pdfMock->shouldReceive('generateOrderPdf')->never();

        [$event, $ticketType] = $this->createPublishedEventWithTicketType();
        $user = User::factory()->create();

        $order = TicketOrder::factory()->paid()->create([
            'user_id' => $user->id,
            'event_id' => $event->id,
        ]);

        $service = app(BilletterieService::class);
        $result = $service->confirmOrder($order->payment_reference);

        $this->assertNotNull($result);

        Mail::assertNothingSent();
    }

    public function test_confirm_order_with_no_email_does_not_fail(): void
    {
        Mail::fake();

        $pdfMock = $this->mock(TicketPdfService::class);
        $pdfMock->shouldReceive('generateOrderPdf')->never();

        [$event, $ticketType] = $this->createPublishedEventWithTicketType();

        $order = TicketOrder::factory()->pending()->create([
            'user_id' => null,
            'event_id' => $event->id,
            'holder_email' => null,
            'total_amount' => 10000,
            'quantity' => 1,
        ]);

        Ticket::factory()->create([
            'ticket_order_id' => $order->id,
            'ticket_type_id' => $ticketType->id,
            'user_id' => null,
            'holder_email' => null,
            'status' => 'pending',
        ]);

        $service = app(BilletterieService::class);
        $confirmed = $service->confirmOrder($order->payment_reference);

        $this->assertNotNull($confirmed);
        $this->assertSame('paid', $confirmed->status);

        Mail::assertNothingSent();
    }

    public function test_ticket_order_creates_correct_number_of_tickets(): void
    {
        config()->set('billetterie.skip_payment', true);
        Mail::fake();

        $pdfMock = $this->mock(TicketPdfService::class);
        $pdfMock->shouldReceive('generateOrderPdf')->andReturn('fake-pdf-bytes');

        [$event, $ticketType] = $this->createPublishedEventWithTicketType();

        $service = app(BilletterieService::class);

        $result = $service->createOrder(
            null,
            $ticketType->id,
            3,
            '127.0.0.1',
            'TestAgent',
            'Jean Dupont',
            'jean@example.com',
            '+22968000000',
            'email',
        );

        $ticketCount = Ticket::where('ticket_order_id', $result['order']->id)->count();
        $this->assertSame(3, $ticketCount);

        $this->assertDatabaseHas('ticket_types', [
            'id' => $ticketType->id,
            'quantity_sold' => 3,
        ]);
    }
}
