
import { GET } from '../app/api/v1/head-office/organization-inventory/route';
import { NextRequest } from 'next/server';

// Mock getServerSession
jest.mock('next-auth');
import { getServerSession } from 'next-auth';

async function test() {
    const mockSession = {
        user: {
            id: 'mock-user-id',
            role: 'HEAD_OFFICE',
            organizationId: 1
        }
    };
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);

    const req = new NextRequest('http://localhost:3000/api/v1/head-office/organization-inventory');
    const response = await GET(req);
    const data = await response.json();

    console.log("--- HO API Response for Org 1 ---");
    console.log("Total:", data.total);
    console.log("Items count:", data.items?.length);
    console.table(data.items?.map((item: any) => ({
        name: item.productName,
        isActive: item.isActive,
        status: item.status
    })));
}

// Since I can't easily run jest-mocked code in a standalone tsx script without setup,
// I'll use a simpler approach: direct DB query that matches the route logic exactly.
